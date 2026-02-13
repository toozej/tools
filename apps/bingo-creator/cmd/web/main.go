package main

import (
	"bingo-creator/internal/services"
	"fmt"
	"log"
	"strconv"

	"github.com/maxence-charriere/go-app/v10/pkg/app"
)

func main() {
	// Set up the app routes
	app.Route("/", func() app.Composer { return &home{} })
	app.Route("/suggestions", func() app.Composer { return &suggestions{} })

	// Start the app only when running in browser
	app.RunWhenOnBrowser()

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
		Version:   "1.0.0",
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
}

// OnMount is called when the component is mounted
func (h *home) OnMount(ctx app.Context) {
	h.generator = services.NewGenerator()
	h.storage = services.NewStorage()
	h.gridSize = 5 // Default 5x5 grid
	h.grid = nil   // No grid initially
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
			app.Div().
				Class("form-group").
				Body(
					app.Label().
						For("trip-name").
						Text("Trip Name"),
					app.Input().
						ID("trip-name").
						Class("form-input").
						Type("text").
						Placeholder("e.g., Austin_NOLA_2024").
						OnChange(h.onTripNameChange).
						Attr("value", h.tripName),
				),
			app.Div().
				Class("form-group").
				Body(
					app.Label().
						For("grid-size").
						Text("Grid Size"),
					app.Select().
						ID("grid-size").
						Class("form-select").
						OnChange(h.onGridSizeChange).
						Body(
							app.Option().Value("3").Text("3x3"),
							app.Option().Value("4").Text("4x4"),
							app.Option().Value("5").Text("5x5").Selected(h.gridSize == 5),
							app.Option().Value("6").Text("6x6"),
							app.Option().Value("7").Text("7x7"),
							app.Option().Value("8").Text("8x8"),
							app.Option().Value("9").Text("9x9"),
							app.Option().Value("10").Text("10x10"),
						),
				),
			app.Div().
				Class("form-group").
				Body(
					app.Label().
						For("items").
						Text("Bingo Items (one per line)"),
					app.Textarea().
						ID("items").
						Class("form-textarea").
						Placeholder("Enter bingo items, one per line...").
						Rows(10).
						OnChange(h.onItemsChange).
						Text(h.itemsInput),
				),
			app.Div().
				Class("form-group checkbox-group").
				Body(
					app.Label().
						Class("checkbox-label").
						Body(
							app.Input().
								ID("show-hints").
								Type("checkbox").
								Checked(h.showHints).
								OnChange(h.onShowHintsChange),
							app.Span().Text("Show item count hints"),
						),
				),
			app.Button().
				Class("btn btn-primary").
				Text("Generate New Card").
				OnClick(h.onGenerateClick),
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

			gridCells = append(gridCells, cell)
		}
	}

	// Build the grid container
	gridContainer := app.Div().
		ID("bingo-grid-container").
		Body(
			app.Div().
				Class("bingo-grid").
				Style("grid-template-columns", fmt.Sprintf("repeat(%d, 1fr)", h.gridSize)).
				Body(gridCells...),
		)

	// Add hint if enabled
	if h.showHints {
		hint := app.P().
			Class("grid-hint").
			Text(fmt.Sprintf("Items: %d available, %d needed (including Free Space)", len(h.items), availableCells))
		return app.Div().Body(
			gridContainer,
			hint,
		)
	}

	return gridContainer
}

// renderToolbar renders the toolbar with action buttons
func (h *home) renderToolbar() app.UI {
	// Only show toolbar if a grid has been generated
	if h.grid == nil {
		return app.Div() // Return empty div instead of nil
	}

	return app.Div().
		Class("toolbar").
		Body(
			app.Button().
				Class("btn btn-success").
				Text("Export PDF").
				OnClick(h.onExportPDFClick),
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
		h.gridSize = size
	}
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

func (h *home) onGenerateClick(ctx app.Context, e app.Event) {
	// Normalize items from the input
	h.items = h.generator.NormalizeItems(h.itemsInput, true)

	// Generate the grid
	h.grid = h.generator.GenerateGrid(h.items, h.gridSize)

	// Store items if trip name is provided
	if h.tripName != "" {
		h.storage.SetItems(h.tripName, h.itemsInput)
	}

	ctx.Update()
}

func (h *home) onExportPDFClick(ctx app.Context, e app.Event) {
	if h.tripName == "" {
		h.tripName = "bingo"
	}

	filename := h.storage.GenerateFilename(h.tripName)

	// Call the JavaScript PDF export function
	app.Window().Call("exportBingoPDF", "bingo-grid-container", filename)
}

func (h *home) onClearClick(ctx app.Context, e app.Event) {
	h.grid = nil
	ctx.Update()
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
