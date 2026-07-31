// terraform-plan-graph serves a local, interactive view of a Terraform plan.
//
// It deliberately uses Terraform's public JSON representation rather than
// Terraform Core's internal plan-file implementation. A saved binary plan is
// converted by invoking the official Terraform CLI with "show -json".
package main

import (
	"bytes"
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/hashicorp/hcl/v2/hclparse"
	"github.com/hashicorp/hcl/v2/hclsyntax"
	tfjson "github.com/hashicorp/terraform-json"
	"github.com/hashicorp/terraform-json/sanitize"
)

//go:embed web/*
var web embed.FS

const sensitivePlaceholder = "(sensitive value redacted)"

const maxUploadedPlanSize = 64 << 20

type options struct {
	planPath      string
	configDir     string
	terraformPath string
	listen        string
	openBrowser   bool
}

type sourceLocation struct {
	Filename  string `json:"filename"`
	StartLine int    `json:"startLine"`
	EndLine   int    `json:"endLine"`
}

type attributeChange struct {
	Path   string `json:"path"`
	Before any    `json:"before"`
	After  any    `json:"after"`
}

type graphNode struct {
	ID              string            `json:"id"`
	Address         string            `json:"address"`
	ModuleAddress   string            `json:"moduleAddress,omitempty"`
	Mode            string            `json:"mode"`
	Type            string            `json:"type"`
	Name            string            `json:"name"`
	Provider        string            `json:"provider,omitempty"`
	Action          string            `json:"action"`
	Actions         []string          `json:"actions,omitempty"`
	ActionReason    string            `json:"actionReason,omitempty"`
	PreviousAddress string            `json:"previousAddress,omitempty"`
	DeferredReason  string            `json:"deferredReason,omitempty"`
	Drifted         bool              `json:"drifted,omitempty"`
	Source          *sourceLocation   `json:"source,omitempty"`
	Dependencies    []string          `json:"dependencies,omitempty"`
	Changes         []attributeChange `json:"changes,omitempty"`
	Before          any               `json:"before,omitempty"`
	After           any               `json:"after,omitempty"`
	Values          any               `json:"values,omitempty"`
	ImportID        string            `json:"importID,omitempty"`
	GeneratedConfig string            `json:"generatedConfig,omitempty"`
}

type graphEdge struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type graphSummary struct {
	Total   int            `json:"total"`
	Actions map[string]int `json:"actions"`
	Drifted int            `json:"drifted"`
}

type graphPayload struct {
	TerraformVersion string       `json:"terraformVersion"`
	PlanFormat       string       `json:"planFormat"`
	Timestamp        string       `json:"timestamp,omitempty"`
	Complete         *bool        `json:"complete,omitempty"`
	Nodes            []*graphNode `json:"nodes"`
	Edges            []graphEdge  `json:"edges"`
	Summary          graphSummary `json:"summary"`
}

func main() {
	opts := parseFlags()

	sources, sourceWarnings := collectSourceLocations(opts.configDir)
	for _, warning := range sourceWarnings {
		log.Printf("source location warning: %s", warning)
	}

	var initialGraphJSON []byte
	if opts.planPath != "" {
		plan, err := readPlan(opts.planPath, opts.terraformPath)
		if err != nil {
			log.Fatal(err)
		}
		initialGraphJSON, err = encodeGraph(plan, sources)
		if err != nil {
			log.Fatal(err)
		}
	}

	listener, err := net.Listen("tcp", opts.listen)
	if err != nil {
		log.Fatalf("listen on %q: %v", opts.listen, err)
	}
	defer listener.Close()

	url := "http://" + listener.Addr().String()
	log.Printf("Terraform plan graph: %s", url)
	log.Printf("Sensitive values marked by Terraform are redacted before the graph is served.")
	if !isLoopbackAddress(listener.Addr().String()) {
		log.Printf("warning: the listener is not loopback-only; anyone who can reach it can inspect non-sensitive plan metadata")
	}
	if opts.openBrowser {
		if err := openURL(url); err != nil {
			log.Printf("could not open browser: %v", err)
		}
	}

	server := &http.Server{
		Handler:           newHandler(initialGraphJSON, sources),
		ReadHeaderTimeout: 5 * time.Second,
	}
	if err := server.Serve(listener); !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("serve: %v", err)
	}
}

func encodeGraph(plan *tfjson.Plan, sources map[string]sourceLocation) ([]byte, error) {
	// A plan often contains credentials. Sanitize before the graph is built so
	// no sensitive value can accidentally be serialized to the browser.
	cleanPlan := plan
	if canSanitizePlan(plan) {
		var err error
		cleanPlan, err = sanitize.SanitizePlanWithValue(plan, sensitivePlaceholder)
		if err != nil {
			return nil, fmt.Errorf("sanitize plan: %w", err)
		}
	}

	data, err := json.Marshal(buildGraph(cleanPlan, sources))
	if err != nil {
		return nil, fmt.Errorf("encode graph: %w", err)
	}
	return data, nil
}

// The sanitizer expects these sections from a complete terraform show -json
// document. The graph builder separately applies Terraform's sensitive-value
// markers, so partial documents remain safe to inspect without panicking.
func canSanitizePlan(plan *tfjson.Plan) bool {
	return plan != nil && plan.Config != nil && plan.Config.RootModule != nil &&
		plan.PlannedValues != nil && plan.PlannedValues.RootModule != nil
}

func parseFlags() options {
	var opts options
	flag.StringVar(&opts.planPath, "plan", "", "saved Terraform plan or terraform show -json output (required)")
	flag.StringVar(&opts.configDir, "config-dir", "", "optional Terraform root module directory for source locations")
	flag.StringVar(&opts.terraformPath, "terraform", "terraform", "Terraform executable to use with binary plans")
	flag.StringVar(&opts.listen, "listen", "127.0.0.1:8765", "HTTP listen address")
	flag.BoolVar(&opts.openBrowser, "open", true, "open the graph in a browser")
	flag.Parse()

	return opts
}

func readPlan(path, terraformPath string) (*tfjson.Plan, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("open plan %q: %w", path, err)
	}
	defer file.Close()

	first, err := firstNonWhitespaceByte(file)
	if err != nil {
		return nil, fmt.Errorf("inspect plan %q: %w", path, err)
	}
	if first == '{' {
		if _, err := file.Seek(0, io.SeekStart); err != nil {
			return nil, fmt.Errorf("rewind JSON plan: %w", err)
		}
		plan, err := decodePlan(file)
		if err != nil {
			return nil, fmt.Errorf("decode Terraform JSON plan %q: %w", path, err)
		}
		return plan, nil
	}

	command := exec.Command(terraformPath, "show", "-json", path)
	output, err := command.Output()
	if err != nil {
		var exitError *exec.ExitError
		if errors.As(err, &exitError) {
			return nil, fmt.Errorf("convert binary plan with %q: %s", terraformPath, strings.TrimSpace(string(exitError.Stderr)))
		}
		return nil, fmt.Errorf("run %q show -json %q: %w", terraformPath, path, err)
	}

	plan, err := decodePlan(bytes.NewReader(output))
	if err != nil {
		return nil, fmt.Errorf("decode JSON emitted by Terraform: %w", err)
	}
	return plan, nil
}

func firstNonWhitespaceByte(reader io.Reader) (byte, error) {
	buffer := make([]byte, 1)
	for {
		_, err := reader.Read(buffer)
		if err != nil {
			return 0, err
		}
		if !strings.ContainsRune(" \t\r\n", rune(buffer[0])) {
			return buffer[0], nil
		}
	}
}

func decodePlan(reader io.Reader) (*tfjson.Plan, error) {
	plan := &tfjson.Plan{}
	plan.UseJSONNumber(true)
	if err := json.NewDecoder(reader).Decode(plan); err != nil {
		return nil, err
	}
	return plan, nil
}

// collectSourceLocations parses the supplied root module using HashiCorp HCL.
// The plan itself does not expose source ranges, and module source trees are
// intentionally not guessed because their location is installation-specific.
func collectSourceLocations(configDir string) (map[string]sourceLocation, []string) {
	locations := make(map[string]sourceLocation)
	if configDir == "" {
		return locations, nil
	}

	paths, err := filepath.Glob(filepath.Join(configDir, "*.tf"))
	if err != nil {
		return locations, []string{err.Error()}
	}
	parser := hclparse.NewParser()
	var warnings []string
	for _, path := range paths {
		file, diagnostics := parser.ParseHCLFile(path)
		if diagnostics.HasErrors() {
			warnings = append(warnings, diagnostics.Error())
			continue
		}
		body, ok := file.Body.(*hclsyntax.Body)
		if !ok {
			continue
		}
		for _, block := range body.Blocks {
			address, ok := sourceAddressForBlock(block)
			if !ok {
				continue
			}
			definitionRange := block.DefRange()
			fullRange := block.Range()
			locations[address] = sourceLocation{
				Filename:  definitionRange.Filename,
				StartLine: definitionRange.Start.Line,
				EndLine:   fullRange.End.Line,
			}
		}
	}
	return locations, warnings
}

func sourceAddressForBlock(block *hclsyntax.Block) (string, bool) {
	if len(block.Labels) != 2 {
		return "", false
	}
	switch block.Type {
	case "resource":
		return block.Labels[0] + "." + block.Labels[1], true
	case "data":
		return "data." + block.Labels[0] + "." + block.Labels[1], true
	default:
		return "", false
	}
}

func buildGraph(plan *tfjson.Plan, sourceLocations map[string]sourceLocation) graphPayload {
	nodes := make(map[string]*graphNode)
	edges := make(map[string]graphEdge)

	addState := func(values *tfjson.StateValues, overwriteValues bool) {}
	addState = func(values *tfjson.StateValues, overwriteValues bool) {
		if values == nil {
			return
		}
		var walkModule func(*tfjson.StateModule)
		walkModule = func(module *tfjson.StateModule) {
			if module == nil {
				return
			}
			for _, resource := range module.Resources {
				if resource == nil {
					continue
				}
				node, exists := nodes[resource.Address]
				if !exists {
					node = ensureNode(nodes, resource.Address)
				}
				if overwriteValues || !exists {
					mergeStateResource(node, resource)
				}
				for _, dependency := range resource.DependsOn {
					node.Dependencies = appendUnique(node.Dependencies, dependency)
					edges[dependency+"\x00"+resource.Address] = graphEdge{From: dependency, To: resource.Address}
				}
			}
			for _, child := range module.ChildModules {
				walkModule(child)
			}
		}
		walkModule(values.RootModule)
	}

	// Planned values include all resources after the plan, including no-op
	// resources. Prior state contributes resources only being deleted.
	addState(plan.PlannedValues, true)
	if plan.PriorState != nil {
		addState(plan.PriorState.Values, false)
	}

	applyChange := func(change *tfjson.ResourceChange, drifted bool, deferredReason string) {
		if change == nil {
			return
		}
		node := ensureNode(nodes, change.Address)
		mergeResourceChange(node, change)
		node.Drifted = node.Drifted || drifted
		if deferredReason != "" {
			node.DeferredReason = deferredReason
		}
	}
	for _, change := range plan.ResourceChanges {
		applyChange(change, false, "")
	}
	for _, change := range plan.ResourceDrift {
		applyChange(change, true, "")
	}
	for _, deferred := range plan.DeferredChanges {
		if deferred != nil {
			applyChange(deferred.ResourceChange, false, deferred.Reason)
		}
	}

	result := graphPayload{
		TerraformVersion: plan.TerraformVersion,
		PlanFormat:       plan.FormatVersion,
		Timestamp:        plan.Timestamp,
		Complete:         plan.Complete,
		Summary: graphSummary{
			Actions: make(map[string]int),
		},
	}
	for _, node := range nodes {
		if node.Mode == "" {
			node.Mode = "managed"
		}
		if node.Action == "" {
			node.Action = "no-op"
		}
		if location, ok := sourceLocations[rootSourceAddress(node)]; ok {
			copy := location
			node.Source = &copy
		}
		sort.Strings(node.Dependencies)
		result.Nodes = append(result.Nodes, node)
		result.Summary.Actions[node.Action]++
		if node.Drifted {
			result.Summary.Drifted++
		}
	}
	sort.Slice(result.Nodes, func(i, j int) bool { return result.Nodes[i].Address < result.Nodes[j].Address })
	result.Summary.Total = len(result.Nodes)

	for _, edge := range edges {
		if _, ok := nodes[edge.From]; !ok {
			continue
		}
		if _, ok := nodes[edge.To]; !ok {
			continue
		}
		result.Edges = append(result.Edges, edge)
	}
	sort.Slice(result.Edges, func(i, j int) bool {
		if result.Edges[i].From == result.Edges[j].From {
			return result.Edges[i].To < result.Edges[j].To
		}
		return result.Edges[i].From < result.Edges[j].From
	})
	return result
}

func ensureNode(nodes map[string]*graphNode, address string) *graphNode {
	if node, ok := nodes[address]; ok {
		return node
	}
	node := &graphNode{ID: address, Address: address, Action: "no-op"}
	nodes[address] = node
	return node
}

func mergeStateResource(node *graphNode, resource *tfjson.StateResource) {
	node.Address = resource.Address
	node.ModuleAddress = moduleAddress(resource.Address)
	node.Mode = string(resource.Mode)
	node.Type = resource.Type
	node.Name = resource.Name
	node.Provider = resource.ProviderName
	node.Values = redactWithMarkers(resource.AttributeValues, stateSensitiveValues(resource.SensitiveValues), nil)
}

func mergeResourceChange(node *graphNode, resource *tfjson.ResourceChange) {
	node.Address = resource.Address
	node.ModuleAddress = resource.ModuleAddress
	if node.ModuleAddress == "" {
		node.ModuleAddress = moduleAddress(resource.Address)
	}
	node.Mode = string(resource.Mode)
	node.Type = resource.Type
	node.Name = resource.Name
	node.Provider = resource.ProviderName
	node.PreviousAddress = resource.PreviousAddress
	if resource.Change == nil {
		return
	}
	node.Action = actionName(resource.Change.Actions)
	node.Actions = actionStrings(resource.Change.Actions)
	node.Before = redactWithMarkers(resource.Change.Before, resource.Change.BeforeSensitive, nil)
	node.After = redactWithMarkers(resource.Change.After, resource.Change.AfterSensitive, resource.Change.AfterUnknown)
	node.Changes = diffValues(node.Before, node.After)
	if resource.Change.Importing != nil {
		node.ImportID = resource.Change.Importing.ID
	}
	// Generated configuration is supplied by Terraform as HCL. It has already
	// passed through Terraform's sanitizer with the rest of the plan.
	node.GeneratedConfig = resource.Change.GeneratedConfig
}

func stateSensitiveValues(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	var markers any
	if err := json.Unmarshal(raw, &markers); err != nil {
		return nil
	}
	return markers
}

// redactWithMarkers protects values even if a Terraform version emitted a
// sensitive marker that the sanitizer does not yet understand. Unknown values
// are represented explicitly so they are distinguishable from null.
func redactWithMarkers(value, sensitive, unknown any) any {
	if sensitiveBoolean(sensitive) {
		return sensitivePlaceholder
	}
	if sensitiveBoolean(unknown) {
		return "(known after apply)"
	}

	switch typed := value.(type) {
	case map[string]any:
		result := make(map[string]any, len(typed))
		sensitiveMap, _ := sensitive.(map[string]any)
		unknownMap, _ := unknown.(map[string]any)
		keys := make(map[string]struct{}, len(typed)+len(sensitiveMap)+len(unknownMap))
		for key := range typed {
			keys[key] = struct{}{}
		}
		for key := range sensitiveMap {
			keys[key] = struct{}{}
		}
		for key := range unknownMap {
			keys[key] = struct{}{}
		}
		for key := range keys {
			child, present := typed[key]
			if !present && !sensitiveBoolean(sensitiveMap[key]) && !sensitiveBoolean(unknownMap[key]) {
				continue
			}
			result[key] = redactWithMarkers(child, sensitiveMap[key], unknownMap[key])
		}
		return result
	case []any:
		result := make([]any, len(typed))
		sensitiveList, _ := sensitive.([]any)
		unknownList, _ := unknown.([]any)
		for index, child := range typed {
			var sensitiveChild, unknownChild any
			if index < len(sensitiveList) {
				sensitiveChild = sensitiveList[index]
			}
			if index < len(unknownList) {
				unknownChild = unknownList[index]
			}
			result[index] = redactWithMarkers(child, sensitiveChild, unknownChild)
		}
		return result
	default:
		return value
	}
}

func sensitiveBoolean(value any) bool {
	boolean, ok := value.(bool)
	return ok && boolean
}

func diffValues(before, after any) []attributeChange {
	var changes []attributeChange
	diffAtPath("", before, after, &changes)
	return changes
}

func diffAtPath(path string, before, after any, changes *[]attributeChange) {
	beforeMap, beforeIsMap := before.(map[string]any)
	afterMap, afterIsMap := after.(map[string]any)
	if beforeIsMap && afterIsMap {
		keys := make(map[string]struct{}, len(beforeMap)+len(afterMap))
		for key := range beforeMap {
			keys[key] = struct{}{}
		}
		for key := range afterMap {
			keys[key] = struct{}{}
		}
		sortedKeys := make([]string, 0, len(keys))
		for key := range keys {
			sortedKeys = append(sortedKeys, key)
		}
		sort.Strings(sortedKeys)
		for _, key := range sortedKeys {
			diffAtPath(joinAttributePath(path, key), beforeMap[key], afterMap[key], changes)
		}
		return
	}

	beforeList, beforeIsList := before.([]any)
	afterList, afterIsList := after.([]any)
	if beforeIsList && afterIsList && len(beforeList) <= 30 && len(afterList) <= 30 {
		length := len(beforeList)
		if len(afterList) > length {
			length = len(afterList)
		}
		for index := 0; index < length; index++ {
			var beforeItem, afterItem any
			if index < len(beforeList) {
				beforeItem = beforeList[index]
			}
			if index < len(afterList) {
				afterItem = afterList[index]
			}
			diffAtPath(fmt.Sprintf("%s[%d]", path, index), beforeItem, afterItem, changes)
		}
		return
	}

	if !equivalentJSONValue(before, after) {
		if path == "" {
			path = "(resource)"
		}
		*changes = append(*changes, attributeChange{Path: path, Before: before, After: after})
	}
}

func joinAttributePath(parent, child string) string {
	if parent == "" {
		return child
	}
	return parent + "." + child
}

func equivalentJSONValue(left, right any) bool {
	leftJSON, leftErr := json.Marshal(left)
	rightJSON, rightErr := json.Marshal(right)
	return leftErr == nil && rightErr == nil && bytes.Equal(leftJSON, rightJSON)
}

func actionName(actions tfjson.Actions) string {
	switch {
	case actions.Replace():
		return "replace"
	case actions.Create():
		return "create"
	case actions.Update():
		return "update"
	case actions.Delete():
		return "delete"
	case actions.Read():
		return "read"
	case actions.Forget():
		return "forget"
	default:
		return "no-op"
	}
}

func actionStrings(actions tfjson.Actions) []string {
	result := make([]string, 0, len(actions))
	for _, action := range actions {
		result = append(result, string(action))
	}
	return result
}

func appendUnique(values []string, value string) []string {
	for _, existing := range values {
		if existing == value {
			return values
		}
	}
	return append(values, value)
}

func moduleAddress(address string) string {
	parts := strings.Split(address, ".")
	var modules []string
	for index := 0; index+1 < len(parts) && parts[index] == "module"; index += 2 {
		modules = append(modules, "module."+parts[index+1])
	}
	return strings.Join(modules, ".")
}

func rootSourceAddress(node *graphNode) string {
	if node.ModuleAddress != "" || node.Type == "" || node.Name == "" {
		return ""
	}
	if node.Mode == "data" {
		return "data." + node.Type + "." + node.Name
	}
	return node.Type + "." + node.Name
}

func newHandler(initialGraphJSON []byte, sourceLocations map[string]sourceLocation) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/graph", func(writer http.ResponseWriter, request *http.Request) {
		switch request.Method {
		case http.MethodGet:
			if len(initialGraphJSON) == 0 {
				http.Error(writer, "no plan loaded", http.StatusNotFound)
				return
			}
			writeGraphJSON(writer, initialGraphJSON)
		case http.MethodPost:
			request.Body = http.MaxBytesReader(writer, request.Body, maxUploadedPlanSize)
			plan, err := decodePlan(request.Body)
			if err != nil {
				http.Error(writer, fmt.Sprintf("decode Terraform JSON plan: %v", err), http.StatusBadRequest)
				return
			}
			graphJSON, err := encodeGraph(plan, sourceLocations)
			if err != nil {
				http.Error(writer, err.Error(), http.StatusInternalServerError)
				return
			}
			writeGraphJSON(writer, graphJSON)
		default:
			writer.Header().Set("Allow", http.MethodGet+", "+http.MethodPost)
			http.Error(writer, "method not allowed", http.StatusMethodNotAllowed)
		}
	})
	mux.HandleFunc("/api/health", func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet {
			writer.Header().Set("Allow", http.MethodGet)
			http.Error(writer, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		writer.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = writer.Write([]byte(`{"status":"ok"}`))
	})
	mux.HandleFunc("/", func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/" {
			serveEmbeddedFile(writer, "web/index.html", "text/html; charset=utf-8")
			return
		}
		if request.URL.Path == "/app.js" {
			serveEmbeddedFile(writer, "web/app.js", "text/javascript; charset=utf-8")
			return
		}
		if request.URL.Path == "/styles.css" {
			serveEmbeddedFile(writer, "web/styles.css", "text/css; charset=utf-8")
			return
		}
		http.NotFound(writer, request)
	})

	return securityHeaders(mux)
}

func writeGraphJSON(writer http.ResponseWriter, graphJSON []byte) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.Header().Set("Cache-Control", "no-store")
	_, _ = writer.Write(graphJSON)
}

func serveEmbeddedFile(writer http.ResponseWriter, name, contentType string) {
	contents, err := web.ReadFile(name)
	if err != nil {
		http.Error(writer, "embedded UI asset missing", http.StatusInternalServerError)
		return
	}
	writer.Header().Set("Content-Type", contentType)
	writer.Header().Set("Cache-Control", "no-store")
	_, _ = writer.Write(contents)
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Security-Policy", "default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'")
		writer.Header().Set("X-Content-Type-Options", "nosniff")
		writer.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(writer, request)
	})
}

func isLoopbackAddress(address string) bool {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return false
	}
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func openURL(url string) error {
	var command *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		command = exec.Command("open", url)
	case "windows":
		command = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		command = exec.Command("xdg-open", url)
	}
	return command.Start()
}
