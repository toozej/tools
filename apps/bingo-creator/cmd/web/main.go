package main

import (
	"bingo-creator/internal/services"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/maxence-charriere/go-app/v10/pkg/app"
)

// buildVersion can be overridden at build time with:
// -ldflags "-X main.buildVersion=<version>"
var buildVersion = "dev"

func staticSiteVersion() string {
	if buildVersion != "" && buildVersion != "dev" {
		return buildVersion
	}
	// Fallback for local/dev builds to ensure service worker cache invalidates
	// whenever a new static bundle is generated.
	return strconv.FormatInt(time.Now().Unix(), 10)
}

func main() {
	// Set up the app routes
	app.Route("/", func() app.Composer { return &home{} })
	app.Route("/suggestions", func() app.Composer { return &suggestions{} })

	// Start the app only when running in browser
	app.RunWhenOnBrowser()

	version := staticSiteVersion()
	fmt.Println("Generating static website with version:", version)

	err := app.GenerateStaticWebsite(".", &app.Handler{
		Name:        "Bingo Creator",
		Description: "An app for creating bingo cards",
		Author:      "James Tooze",
		Keywords:    []string{"Bingo", "Creator", "WASM", "Go"},
		Styles: []string{
			"/static/app.css",
		},
		Icon: app.Icon{
			Default: "/static/icon.png",
		},
		Scripts: []string{
			"https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
			"https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js",
			"/static/app.js",
		},
		StartURL:  "/bingo-creator/",
		Resources: app.PrefixedLocation("/bingo-creator"),
		Version:   version,
	})

	if err != nil {
		log.Fatal(err)
	}
}

// home is the main bingo creator component
type home struct {
	app.Compo

	// State
	generator *services.Generator
	storage   *services.Storage

	// Form values
	tripName   string
	gridSize   int
	items      []string
	showHints  bool
	grid       [][]string
	itemsInput string

	// Reusable tile pools
	tilePools    []services.TilePool
	selectedPool string
	poolName     string
	poolStatus   string

	// Card play and export state
	batchCount  int
	tabletMode  bool
	markedCells map[int]bool
}

// OnMount is called when the component is mounted
func (h *home) OnMount(ctx app.Context) {
	h.generator = services.NewGenerator()
	h.storage = services.NewStorage()
	h.gridSize = 5 // Default 5x5 grid
	h.grid = nil   // No grid initially
	h.batchCount = 1
	h.markedCells = make(map[int]bool)
	h.tilePools = h.storage.GetTilePools()

	app.Window().Set("onBingoPoolFileLoaded", app.FuncOf(func(this app.Value, args []app.Value) interface{} {
		if len(args) < 2 {
			return nil
		}
		filename := args[0].String()
		items := args[1].String()
		ctx.Dispatch(func(ctx app.Context) {
			poolName := tilePoolNameFromFilename(filename)
			if len(h.generator.NormalizeItems(items, true)) == 0 {
				h.poolStatus = "The uploaded file did not contain any tiles."
				return
			}
			h.saveTilePool(poolName, items)
			h.itemsInput = items
			h.items = h.generator.NormalizeItems(items, true)
			h.poolStatus = fmt.Sprintf("Imported and saved the %q pool.", poolName)
		})
		return nil
	}))

	app.Window().Set("onBingoPoolFileError", app.FuncOf(func(this app.Value, args []app.Value) interface{} {
		ctx.Dispatch(func(ctx app.Context) {
			h.poolStatus = "Could not read that tile file. Please try another plain-text file."
		})
		return nil
	}))
}

// Render renders the home component
func (h *home) Render() app.UI {
	return app.Div().
		Class("container").
		Body(
			app.Header().
				Class("app-header").
				Body(
					app.H1().Class("app-title").Text("Bingo Creator"),
				),
			app.Main().
				Class("app-main").
				Body(
					h.renderControls(),
					h.renderGridPreview(),
					h.renderToolbar(),
				),
			app.Footer().
				Class("app-footer").
				Body(
					app.P().
						Text("Built with Go + WebAssembly using go-app\nBingo icons created by Freepik - Flaticon at https://www.flaticon.com/free-icons/bingo"),
				),
		)
}

// renderControls renders the form controls
func (h *home) renderControls() app.UI {
	return app.Div().
		Class("controls").
		Body(
			app.Div().Class("controls-row").Body(
				app.Div().Class("form-group").Body(
					app.Label().For("trip-name").Text("Trip Name"),
					app.Input().ID("trip-name").Class("form-input").Type("text").
						Placeholder("e.g., Austin_NOLA_2024").OnChange(h.onTripNameChange).
						Attr("value", h.tripName),
				),
				app.Div().Class("form-group").Body(
					app.Label().For("grid-size").Text("Grid Size"),
					app.Select().ID("grid-size").Class("form-select").OnChange(h.onGridSizeChange).Body(
						app.Option().Value("3").Text("3x3").Selected(h.gridSize == 3),
						app.Option().Value("4").Text("4x4").Selected(h.gridSize == 4),
						app.Option().Value("5").Text("5x5").Selected(h.gridSize == 5),
						app.Option().Value("6").Text("6x6").Selected(h.gridSize == 6),
						app.Option().Value("7").Text("7x7").Selected(h.gridSize == 7),
						app.Option().Value("8").Text("8x8").Selected(h.gridSize == 8),
						app.Option().Value("9").Text("9x9").Selected(h.gridSize == 9),
						app.Option().Value("10").Text("10x10").Selected(h.gridSize == 10),
					),
				),
				app.Div().Class("form-group").Body(
					app.Label().For("batch-count").Text("Cards to export"),
					app.Input().ID("batch-count").Class("form-input").Type("number").
						Min(1).Max(50).Attr("value", h.batchCount).OnChange(h.onBatchCountChange),
				),
			),
			h.renderTilePools(),
			app.Div().Class("form-group").Body(
				app.Label().For("items").Text("Bingo Items (one per line)"),
				app.Textarea().ID("items").Class("form-textarea").
					Placeholder("Enter bingo items, one per line...").Rows(10).
					OnChange(h.onItemsChange).Text(h.itemsInput),
			),
			app.Div().Class("form-group checkbox-group").Body(
				app.Label().Class("checkbox-label").Body(
					app.Input().ID("show-hints").Type("checkbox").Checked(h.showHints).OnChange(h.onShowHintsChange),
					app.Span().Text("Show item count hints"),
				),
			),
			app.Div().Class("form-group checkbox-group").Body(
				app.Label().Class("checkbox-label").Body(
					app.Input().ID("tablet-mode").Type("checkbox").Checked(h.tabletMode).OnChange(h.onTabletModeChange),
					app.Span().Text("Tablet play mode (tap tiles to mark them)"),
				),
			),
			app.Button().
				Class("btn btn-primary").
				Text("Generate New Card").
				OnClick(h.onGenerateClick),
		)
}

// renderTilePools renders reusable tile pool controls. Pools can be created
// from the current list or imported from a newline-delimited text file.
func (h *home) renderTilePools() app.UI {
	poolOptions := []app.UI{
		app.Option().Value("").Text("Choose a saved pool...").Selected(h.selectedPool == ""),
	}
	for _, pool := range h.tilePools {
		poolOptions = append(poolOptions,
			app.Option().Value(pool.Name).Text(pool.Name).Selected(h.selectedPool == pool.Name),
		)
	}

	return app.Div().Class("tile-pools").Body(
		app.Div().Class("section-heading").Body(
			app.H2().Text("Tile pools"),
			app.P().Text("Save a reusable list or import a plain-text file with one tile per line."),
		),
		app.Div().Class("pool-controls").Body(
			app.Div().Class("form-group").Body(
				app.Label().For("tile-pool-select").Text("Saved pools"),
				app.Select().ID("tile-pool-select").Class("form-select").
					OnChange(h.onSelectedPoolChange).Body(poolOptions...),
			),
			app.Div().Class("pool-actions").Body(
				app.Button().Class("btn btn-secondary").Text("Use pool").
					Disabled(h.selectedPool == "").OnClick(h.onUsePoolClick),
				app.Button().Class("btn btn-secondary").Text("Download pool").
					Disabled(h.selectedPool == "").OnClick(h.onDownloadPoolClick),
				app.Button().Class("btn btn-secondary").Text("Delete pool").
					Disabled(h.selectedPool == "").OnClick(h.onDeletePoolClick),
			),
		),
		app.Div().Class("pool-controls").Body(
			app.Div().Class("form-group").Body(
				app.Label().For("tile-pool-name").Text("Pool name"),
				app.Input().ID("tile-pool-name").Class("form-input").Type("text").
					Placeholder("e.g., Road trip").Attr("value", h.poolName).OnChange(h.onPoolNameChange),
			),
			app.Div().Class("pool-actions").Body(
				app.Button().Class("btn btn-secondary").Text("Save current tiles").OnClick(h.onSavePoolClick),
				app.Label().Class("btn btn-secondary").For("tile-pool-file").Text("Upload .txt pool"),
				app.Input().ID("tile-pool-file").Type("file").Accept(".txt,text/plain").
					Style("display", "none").OnChange(h.onPoolFileChange),
			),
		),
		app.If(h.poolStatus != "", func() app.UI {
			return app.P().Class("pool-status").Text(h.poolStatus)
		}),
	)
}

// renderGridPreview renders the bingo grid preview
func (h *home) renderGridPreview() app.UI {
	// If no grid has been generated yet, show placeholder
	if h.grid == nil {
		return app.Div().
			ID("bingo-grid-container").
			Class("grid-placeholder").
			Body(
				app.P().Text("Enter your bingo items and click \"Generate New Card\" to create a bingo card."),
			)
	}

	// Calculate required cells
	requiredCells := h.gridSize * h.gridSize
	_ = requiredCells                   // Avoid unused variable error
	availableCells := requiredCells - 1 // Minus free space

	// Build grid UI
	gridCells := []app.UI{}
	for row := 0; row < h.gridSize; row++ {
		for col := 0; col < h.gridSize; col++ {
			cellIndex := row*h.gridSize + col
			cellText := h.grid[row][col]
			isFreeSpace := row == h.gridSize/2 && col == h.gridSize/2

			cell := app.Div().
				Class("grid-cell").
				Body(
					app.Span().Class("cell-text").Text(cellText),
				)

			if isFreeSpace {
				cell = cell.Class("free-space")
			}
			if h.markedCells[cellIndex] {
				cell = cell.Class("marked")
			}
			if h.tabletMode {
				cell = cell.
					Class("playable-cell").
					Attr("role", "button").
					Attr("tabindex", "0").
					OnClick(h.onGridCellClick(cellIndex))
			}

			gridCells = append(gridCells, cell)
		}
	}

	gridClass := "bingo-grid"
	if h.tabletMode {
		gridClass += " tablet-grid"
	}

	// Build the grid container
	gridContainer := app.Div().
		ID("bingo-grid-container").
		Body(
			app.Div().
				Class(gridClass).
				Style("grid-template-columns", fmt.Sprintf("repeat(%d, 1fr)", h.gridSize)).
				Body(gridCells...),
		)

	// Add hint if enabled
	if h.showHints {
		hint := app.P().
			Class("grid-hint").
			Text(fmt.Sprintf("Items: %d available, %d needed plus Free Space", len(h.items), availableCells))
		return app.Div().Body(
			gridContainer,
			hint,
		)
	}

	return gridContainer
}

// renderToolbar renders the toolbar with action buttons
func (h *home) renderToolbar() app.UI {
	if h.grid == nil {
		return app.Div()
	}

	return app.Div().
		Class("toolbar").
		Body(
			app.Button().
				Class("btn btn-success").
				Text("Export Card PDF").
				OnClick(h.onExportPDFClick),
			app.Button().
				Class("btn btn-success btn-batch-export").
				Text(fmt.Sprintf("Export %d PDFs", h.batchCount)).
				OnClick(h.onExportBatchPDFClick),
			app.Button().
				Class("btn btn-secondary").
				Text("Randomize Tiles").
				OnClick(h.onRandomizeClick),
			app.Button().
				Class("btn btn-secondary").
				Text("Clear Marks").
				Disabled(!h.tabletMode && len(h.markedCells) == 0).
				OnClick(h.onClearMarksClick),
			app.Button().
				Class("btn btn-secondary").
				Text("Clear Card").
				OnClick(h.onClearClick),
		)
}

// Event handlers

func (h *home) onTripNameChange(ctx app.Context, e app.Event) {
	h.tripName = ctx.JSSrc().Get("value").String()
	ctx.Update()
}

func (h *home) onGridSizeChange(ctx app.Context, e app.Event) {
	value := ctx.JSSrc().Get("value").String()
	if size, err := strconv.Atoi(value); err == nil {
		if h.gridSize != size {
			h.gridSize = size
			h.grid = nil
			h.resetMarks()
		}
	}
	ctx.Update()
}

func (h *home) onBatchCountChange(ctx app.Context, e app.Event) {
	value := ctx.JSSrc().Get("value").String()
	count, err := strconv.Atoi(value)
	if err != nil || count < 1 {
		count = 1
	}
	if count > 50 {
		count = 50
	}
	h.batchCount = count
	ctx.Update()
}

func (h *home) onItemsChange(ctx app.Context, e app.Event) {
	h.itemsInput = ctx.JSSrc().Get("value").String()
	h.items = h.generator.NormalizeItems(h.itemsInput, true)
	ctx.Update()
}

func (h *home) onShowHintsChange(ctx app.Context, e app.Event) {
	h.showHints = ctx.JSSrc().Get("checked").Bool()
	ctx.Update()
}

func (h *home) onTabletModeChange(ctx app.Context, e app.Event) {
	h.tabletMode = ctx.JSSrc().Get("checked").Bool()
	if h.tabletMode && h.grid != nil && len(h.markedCells) == 0 {
		h.resetMarks()
	}
	ctx.Update()
}

func (h *home) onGenerateClick(ctx app.Context, e app.Event) {
	h.generateCard()
	ctx.Update()
}

func (h *home) onRandomizeClick(ctx app.Context, e app.Event) {
	if h.grid == nil {
		return
	}
	h.grid = h.generator.ShuffleGrid(h.grid)
	h.resetMarks()
	ctx.Update()
}

func (h *home) onClearMarksClick(ctx app.Context, e app.Event) {
	h.resetMarks()
	ctx.Update()
}

func (h *home) onGridCellClick(cellIndex int) app.EventHandler {
	return func(ctx app.Context, e app.Event) {
		if !h.tabletMode || h.grid == nil {
			return
		}
		if h.markedCells[cellIndex] {
			delete(h.markedCells, cellIndex)
		} else {
			h.markedCells[cellIndex] = true
		}
		ctx.Update()
	}
}

func (h *home) onExportPDFClick(ctx app.Context, e app.Event) {
	h.ensureTripName()
	filename := h.storage.GenerateFilename(h.tripName)
	ctx.Update()
	app.Window().Call("exportBingoPDF", "bingo-grid-container", filename)
}

func (h *home) onExportBatchPDFClick(ctx app.Context, e app.Event) {
	h.ensureTripName()
	h.items = h.generator.NormalizeItems(h.itemsInput, true)
	if h.batchCount < 1 {
		h.batchCount = 1
	}

	cards := make([]any, h.batchCount)
	for i := 0; i < h.batchCount; i++ {
		grid := h.generator.GenerateGrid(h.items, h.gridSize)
		cards[i] = gridToJS(grid)
		if i == 0 {
			h.grid = grid
		}
	}
	h.resetMarks()
	if h.tripName != "" {
		h.storage.SetItems(h.tripName, h.itemsInput)
	}

	filenameBase := services.SanitizeFilename(h.tripName)
	if filenameBase == "" {
		filenameBase = "bingo"
	}
	ctx.Update()
	app.Window().Call("exportBingoPDFBatch", cards, "bingo_card_"+filenameBase)
}

func (h *home) onClearClick(ctx app.Context, e app.Event) {
	h.grid = nil
	h.resetMarks()
	ctx.Update()
}

func (h *home) onSelectedPoolChange(ctx app.Context, e app.Event) {
	h.selectedPool = ctx.JSSrc().Get("value").String()
	if pool, ok := h.findTilePool(h.selectedPool); ok {
		h.poolName = pool.Name
	}
	ctx.Update()
}

func (h *home) onPoolNameChange(ctx app.Context, e app.Event) {
	h.poolName = ctx.JSSrc().Get("value").String()
	ctx.Update()
}

func (h *home) onUsePoolClick(ctx app.Context, e app.Event) {
	pool, ok := h.findTilePool(h.selectedPool)
	if !ok {
		return
	}
	h.itemsInput = pool.Items
	h.items = h.generator.NormalizeItems(pool.Items, true)
	h.poolName = pool.Name
	h.poolStatus = fmt.Sprintf("Loaded the %q pool.", pool.Name)
	ctx.Update()
}

func (h *home) onSavePoolClick(ctx app.Context, e app.Event) {
	name := strings.TrimSpace(h.poolName)
	if name == "" {
		h.poolStatus = "Enter a pool name before saving."
		ctx.Update()
		return
	}
	if len(h.generator.NormalizeItems(h.itemsInput, true)) == 0 {
		h.poolStatus = "Add at least one tile before saving a pool."
		ctx.Update()
		return
	}
	h.saveTilePool(name, h.itemsInput)
	h.poolStatus = fmt.Sprintf("Saved the %q pool.", name)
	ctx.Update()
}

func (h *home) onDeletePoolClick(ctx app.Context, e app.Event) {
	if h.selectedPool == "" {
		return
	}
	deletedPool := h.selectedPool
	h.storage.DeleteTilePool(deletedPool)
	h.tilePools = h.storage.GetTilePools()
	h.selectedPool = ""
	h.poolName = ""
	h.poolStatus = fmt.Sprintf("Deleted the %q pool.", deletedPool)
	ctx.Update()
}

func (h *home) onDownloadPoolClick(ctx app.Context, e app.Event) {
	pool, ok := h.findTilePool(h.selectedPool)
	if !ok {
		return
	}
	filename := services.SanitizeFilename(pool.Name)
	if filename == "" {
		filename = "bingo_tiles"
	}
	app.Window().Call("downloadBingoTilePool", pool.Items, filename+".txt")
}

func (h *home) onPoolFileChange(ctx app.Context, e app.Event) {
	files := ctx.JSSrc().Get("files")
	if files.Length() == 0 {
		return
	}
	h.poolStatus = "Importing tile pool..."
	ctx.Update()
	app.Window().Call("loadBingoPoolFile", files)
}

func (h *home) generateCard() {
	h.items = h.generator.NormalizeItems(h.itemsInput, true)
	h.grid = h.generator.GenerateGrid(h.items, h.gridSize)
	h.resetMarks()
	if h.tripName != "" {
		h.storage.SetItems(h.tripName, h.itemsInput)
	}
}

func (h *home) resetMarks() {
	h.markedCells = make(map[int]bool)
	if h.tabletMode && h.grid != nil {
		center := (h.gridSize/2)*h.gridSize + h.gridSize/2
		h.markedCells[center] = true
	}
}

func (h *home) ensureTripName() {
	if h.tripName == "" {
		h.tripName = "bingo"
	}
}

func (h *home) findTilePool(name string) (services.TilePool, bool) {
	for _, pool := range h.tilePools {
		if pool.Name == name {
			return pool, true
		}
	}
	return services.TilePool{}, false
}

func (h *home) saveTilePool(name, items string) {
	name = strings.TrimSpace(name)
	h.storage.SetTilePool(name, items)
	h.tilePools = h.storage.GetTilePools()
	h.selectedPool = name
	h.poolName = name
}

func tilePoolNameFromFilename(filename string) string {
	name := strings.TrimSpace(filename)
	if dot := strings.LastIndex(name, "."); dot > 0 {
		name = name[:dot]
	}
	if name == "" {
		return "Imported tiles"
	}
	return name
}

func gridToJS(grid [][]string) []any {
	rows := make([]any, len(grid))
	for rowIndex, row := range grid {
		cells := make([]any, len(row))
		for cellIndex, cell := range row {
			cells[cellIndex] = cell
		}
		rows[rowIndex] = cells
	}
	return rows
}

// suggestions is the suggestions page component
type suggestions struct {
	app.Compo
}

// Render renders the suggestions component
func (s *suggestions) Render() app.UI {
	return app.Div().
		Class("container").
		Body(
			app.Header().
				Class("app-header").
				Body(
					app.H1().Class("app-title").Text("Bingo Suggestions"),
					app.Button().
						Class("btn btn-back").
						Text("← Back to Bingo Creator").
						OnClick(s.onBackClick),
				),
			app.Main().
				Class("app-main suggestions-main").
				Body(
					app.Div().
						Class("suggestions-placeholder").
						Body(
							app.H2().Text("Coming Soon"),
							app.P().Text("This feature is under development. Soon you'll be able to browse and add bingo suggestions from a community library."),
						),
				),
		)
}

func (s *suggestions) onBackClick(ctx app.Context, e app.Event) {
	ctx.Navigate("/")
}
