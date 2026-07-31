package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/hashicorp/hcl/v2/hclparse"
	"github.com/hashicorp/hcl/v2/hclsyntax"
	tfjson "github.com/hashicorp/terraform-json"
)

func TestBuildGraphIncludesCurrentAndDeletedResources(t *testing.T) {
	plan := &tfjson.Plan{
		PlannedValues: &tfjson.StateValues{RootModule: &tfjson.StateModule{Resources: []*tfjson.StateResource{
			{
				Address:         "aws_instance.web",
				Mode:            tfjson.ManagedResourceMode,
				Type:            "aws_instance",
				Name:            "web",
				AttributeValues: map[string]any{"ami": "ami-new", "id": "new-id"},
				DependsOn:       []string{"aws_vpc.network"},
			},
			{Address: "aws_vpc.network", Mode: tfjson.ManagedResourceMode, Type: "aws_vpc", Name: "network"},
		}}},
		PriorState: &tfjson.State{Values: &tfjson.StateValues{RootModule: &tfjson.StateModule{Resources: []*tfjson.StateResource{
			{Address: "aws_s3_bucket.old", Mode: tfjson.ManagedResourceMode, Type: "aws_s3_bucket", Name: "old"},
		}}}},
		ResourceChanges: []*tfjson.ResourceChange{
			{
				Address: "aws_instance.web",
				Mode:    tfjson.ManagedResourceMode,
				Type:    "aws_instance",
				Name:    "web",
				Change:  &tfjson.Change{Actions: tfjson.Actions{tfjson.ActionUpdate}, Before: map[string]any{"ami": "ami-old"}, After: map[string]any{"ami": "ami-new"}},
			},
			{
				Address: "aws_s3_bucket.old",
				Mode:    tfjson.ManagedResourceMode,
				Type:    "aws_s3_bucket",
				Name:    "old",
				Change:  &tfjson.Change{Actions: tfjson.Actions{tfjson.ActionDelete}, Before: map[string]any{"id": "old"}},
			},
		},
	}

	graph := buildGraph(plan, nil)
	if got, want := graph.Summary.Total, 3; got != want {
		t.Fatalf("node count = %d, want %d", got, want)
	}
	if got, want := graph.Summary.Actions["update"], 1; got != want {
		t.Fatalf("update count = %d, want %d", got, want)
	}
	if got, want := graph.Summary.Actions["delete"], 1; got != want {
		t.Fatalf("delete count = %d, want %d", got, want)
	}
	if got, want := len(graph.Edges), 1; got != want {
		t.Fatalf("edge count = %d, want %d", got, want)
	}
}

func TestGraphUploadAndHealthEndpoints(t *testing.T) {
	plan := &tfjson.Plan{
		FormatVersion: "1.2",
		PlannedValues: &tfjson.StateValues{RootModule: &tfjson.StateModule{Resources: []*tfjson.StateResource{{
			Address: "aws_vpc.network",
			Mode:    tfjson.ManagedResourceMode,
			Type:    "aws_vpc",
			Name:    "network",
		}}}},
	}
	body, err := json.Marshal(plan)
	if err != nil {
		t.Fatalf("marshal plan: %v", err)
	}

	handler := newHandler(nil, nil)

	missing := httptest.NewRecorder()
	handler.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, "/api/graph", nil))
	if missing.Code != http.StatusNotFound {
		t.Fatalf("empty graph status = %d, want %d", missing.Code, http.StatusNotFound)
	}

	graph := httptest.NewRecorder()
	handler.ServeHTTP(graph, httptest.NewRequest(http.MethodPost, "/api/graph", bytes.NewReader(body)))
	if graph.Code != http.StatusOK {
		t.Fatalf("upload status = %d, body = %s", graph.Code, graph.Body.String())
	}
	if !bytes.Contains(graph.Body.Bytes(), []byte("aws_vpc.network")) {
		t.Fatalf("graph response does not contain uploaded resource: %s", graph.Body.String())
	}

	health := httptest.NewRecorder()
	handler.ServeHTTP(health, httptest.NewRequest(http.MethodGet, "/api/health", nil))
	if health.Code != http.StatusOK || health.Body.String() != `{"status":"ok"}` {
		t.Fatalf("health response = %d %q", health.Code, health.Body.String())
	}
}

func TestHandler_MethodsAndSecurityHeaders(t *testing.T) {
	handler := newHandler(nil, nil)
	tests := []struct {
		name       string
		method     string
		path       string
		wantStatus int
		wantAllow  string
	}{
		{
			name:       "health accepts GET",
			method:     http.MethodGet,
			path:       "/api/health",
			wantStatus: http.StatusOK,
		},
		{
			name:       "health rejects POST",
			method:     http.MethodPost,
			path:       "/api/health",
			wantStatus: http.StatusMethodNotAllowed,
			wantAllow:  http.MethodGet,
		},
		{
			name:       "graph rejects PUT",
			method:     http.MethodPut,
			path:       "/api/graph",
			wantStatus: http.StatusMethodNotAllowed,
			wantAllow:  http.MethodGet + ", " + http.MethodPost,
		},
		{
			name:       "unknown route is not found",
			method:     http.MethodGet,
			path:       "/missing",
			wantStatus: http.StatusNotFound,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			handler.ServeHTTP(recorder, httptest.NewRequest(test.method, test.path, nil))

			if got := recorder.Code; got != test.wantStatus {
				t.Errorf("status = %d, want %d", got, test.wantStatus)
			}
			if got := recorder.Header().Get("Allow"); got != test.wantAllow {
				t.Errorf("Allow = %q, want %q", got, test.wantAllow)
			}
			if got := recorder.Header().Get("Content-Security-Policy"); got == "" {
				t.Error("Content-Security-Policy header is missing")
			}
		})
	}
}

func TestDecodePlan(t *testing.T) {
	tests := []struct {
		name     string
		contents string
		wantErr  bool
	}{
		{
			name:     "valid plan",
			contents: `{"format_version":"1.2","planned_values":{"root_module":{"resources":[]}}}`,
		},
		{
			name:     "missing format version",
			contents: `{"planned_values":{"root_module":{"resources":[]}}}`,
			wantErr:  true,
		},
		{
			name:     "invalid JSON",
			contents: `{`,
			wantErr:  true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			plan, err := decodePlan(strings.NewReader(test.contents))
			if test.wantErr {
				if err == nil {
					t.Fatal("decodePlan returned nil error")
				}
				return
			}
			if err != nil {
				t.Fatalf("decodePlan: %v", err)
			}
			if plan.FormatVersion != "1.2" {
				t.Errorf("format version = %q, want 1.2", plan.FormatVersion)
			}
		})
	}
}

func TestBuildGraph_TracksDriftDeferredChangesAndImports(t *testing.T) {
	plan := &tfjson.Plan{
		PlannedValues: &tfjson.StateValues{RootModule: &tfjson.StateModule{Resources: []*tfjson.StateResource{
			{
				Address:         "aws_vpc.network",
				Mode:            tfjson.ManagedResourceMode,
				Type:            "aws_vpc",
				Name:            "network",
				AttributeValues: map[string]any{"id": "vpc-123"},
			},
			{
				Address:         "aws_instance.api",
				Mode:            tfjson.ManagedResourceMode,
				Type:            "aws_instance",
				Name:            "api",
				DependsOn:       []string{"aws_vpc.network"},
				AttributeValues: map[string]any{"instance_type": "t3.small"},
			},
		}}},
		ResourceDrift: []*tfjson.ResourceChange{{
			Address: "aws_instance.api",
			Mode:    tfjson.ManagedResourceMode,
			Type:    "aws_instance",
			Name:    "api",
			Change: &tfjson.Change{
				Actions: tfjson.Actions{tfjson.ActionUpdate},
				Before:  map[string]any{"instance_type": "t3.small"},
				After:   map[string]any{"instance_type": "t3.micro"},
			},
		}},
		DeferredChanges: []*tfjson.DeferredResourceChange{{
			Reason: "provider_config_unknown",
			ResourceChange: &tfjson.ResourceChange{
				Address: "aws_instance.worker",
				Mode:    tfjson.ManagedResourceMode,
				Type:    "aws_instance",
				Name:    "worker",
				Change: &tfjson.Change{
					Actions:   tfjson.Actions{tfjson.ActionCreate},
					Importing: &tfjson.Importing{ID: "i-demo-worker"},
				},
			},
		}},
	}

	graph := buildGraph(plan, nil)
	if got, want := graph.Summary.Total, 3; got != want {
		t.Fatalf("node count = %d, want %d", got, want)
	}
	if got, want := graph.Summary.Drifted, 1; got != want {
		t.Errorf("drifted count = %d, want %d", got, want)
	}
	if got, want := len(graph.Edges), 1; got != want {
		t.Fatalf("edge count = %d, want %d", got, want)
	}

	nodes := make(map[string]*graphNode, len(graph.Nodes))
	for _, node := range graph.Nodes {
		nodes[node.ID] = node
	}
	if node := nodes["aws_instance.api"]; node == nil || !node.Drifted || node.Action != "update" {
		t.Errorf("drifted node = %#v, want update with drift", node)
	}
	if node := nodes["aws_instance.worker"]; node == nil || node.DeferredReason != "provider_config_unknown" || node.ImportID != "i-demo-worker" {
		t.Errorf("deferred node = %#v, want deferred import metadata", node)
	}
}

func TestDemoPlansCanBeRendered(t *testing.T) {
	planDirectory := filepath.Join("..", "..", "examples")
	entries, err := os.ReadDir(planDirectory)
	if err != nil {
		t.Fatalf("read demo plans: %v", err)
	}

	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		t.Run(entry.Name(), func(t *testing.T) {
			contents, err := os.ReadFile(filepath.Join(planDirectory, entry.Name()))
			if err != nil {
				t.Fatalf("read demo plan: %v", err)
			}

			plan, err := decodePlan(bytes.NewReader(contents))
			if err != nil {
				t.Fatalf("decode demo plan: %v", err)
			}
			graphJSON, err := encodeGraph(plan, nil)
			if err != nil {
				t.Fatalf("render demo plan: %v", err)
			}

			var graph graphPayload
			if err := json.Unmarshal(graphJSON, &graph); err != nil {
				t.Fatalf("decode graph: %v", err)
			}
			if graph.Summary.Total == 0 {
				t.Fatal("demo plan did not produce graph nodes")
			}
			if strings.Contains(string(graphJSON), "synthetic-certificate-data") {
				t.Fatal("sensitive demo value was exposed in graph output")
			}
		})
	}
}

func TestRedactWithMarkersMarksSensitiveAndUnknownValues(t *testing.T) {
	value := map[string]any{"password": "not-for-the-browser", "id": "known"}
	sensitive := map[string]any{"password": true}
	unknown := map[string]any{"id": true}

	got := redactWithMarkers(value, sensitive, unknown).(map[string]any)
	if got["password"] != sensitivePlaceholder {
		t.Fatalf("password = %#v, want redacted", got["password"])
	}
	if got["id"] != "(known after apply)" {
		t.Fatalf("id = %#v, want known-after-apply marker", got["id"])
	}
}

func TestSourceAddressForBlock(t *testing.T) {
	parser := hclparse.NewParser()
	file, diagnostics := parser.ParseHCL([]byte(`
resource "aws_instance" "web" {}
data "aws_ami" "base" {}
`), "main.tf")
	if diagnostics.HasErrors() {
		t.Fatalf("parse HCL: %s", diagnostics.Error())
	}
	body := file.Body.(*hclsyntax.Body)

	first, ok := sourceAddressForBlock(body.Blocks[0])
	if !ok || first != "aws_instance.web" {
		t.Fatalf("first address = %q, ok = %v", first, ok)
	}
	second, ok := sourceAddressForBlock(body.Blocks[1])
	if !ok || second != "data.aws_ami.base" {
		t.Fatalf("second address = %q, ok = %v", second, ok)
	}
}
