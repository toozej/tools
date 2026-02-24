package main

import (
	"encoding/base64"
	"fmt"
	"log"
	"md-converter/internal/services"
	"strings"

	"github.com/maxence-charriere/go-app/v10/pkg/app"
)

func main() {
	app.Route("/", func() app.Composer { return &home{} })
	app.RunWhenOnBrowser()

	err := app.GenerateStaticWebsite(".", &app.Handler{
		Name:        "md-converter",
		Description: "Convert Markdown files to e-ink optimised EPUB or XTC files",
		Author:      "James Tooze",
		Keywords:    []string{"Markdown", "EPUB", "XTC", "E-Ink", "WASM", "Go"},
		Styles: []string{
			"/static/app.css",
		},
		Icon: app.Icon{
			Default: "/static/icon.png",
		},
		Scripts: []string{
			"/static/app.js",
			"/static/crengine.js",
			"/static/xtc.js",
		},
		StartURL:  "/md-converter/",
		Resources: app.PrefixedLocation("/md-converter"),
		Version:   "1.0.0",
	})
	if err != nil {
		log.Fatal(err)
	}
}

// inputMethod distinguishes between file upload and URL loading.
type inputMethod int

const (
	methodFile inputMethod = iota
	methodURL
)

// home is the main md-converter component.
type home struct {
	app.Compo

	// Input state
	method   inputMethod
	fileData []byte
	fileName string
	fileURL  string
	dragOver bool

	// Settings
	presetIndex int
	formatIndex int
	landscape   bool

	// Conversion state
	converting   bool
	converted    bool
	sectionCount int
	epubData     []byte
	epubName     string
	statusMsg    string
	errorMsg     string

	// XTC generation state
	generatingXTC bool
	xtcComplete   bool
	xtcExt        string
}

func (h *home) OnMount(ctx app.Context) {
	// Register JS callback for file reading result.
	app.Window().Set("onFileRead", app.FuncOf(func(this app.Value, args []app.Value) interface{} {
		if len(args) < 2 {
			return nil
		}
		name := args[0].String()
		b64 := args[1].String()
		data, err := base64.StdEncoding.DecodeString(b64)
		if err != nil {
			ctx.Dispatch(func(ctx app.Context) {
				h.errorMsg = fmt.Sprintf("Failed to decode file: %v", err)
			})
			return nil
		}
		ctx.Dispatch(func(ctx app.Context) {
			h.fileData = data
			h.fileName = name
			h.errorMsg = ""
			h.converted = false
			h.statusMsg = fmt.Sprintf("Loaded: %s (%s)", name, formatBytes(len(data)))
		})
		return nil
	}))

	// Callback for when XTC generating finishes
	app.Window().Set("onXtcComplete", app.FuncOf(func(this app.Value, args []app.Value) interface{} {
		ext := ".xtc"
		if len(args) > 0 {
			ext = args[0].String()
		}
		ctx.Dispatch(func(ctx app.Context) {
			h.generatingXTC = false
			h.xtcComplete = true
			h.xtcExt = ext
			h.statusMsg = ""
		})
		return nil
	}))

	app.Window().Set("onXtcError", app.FuncOf(func(this app.Value, args []app.Value) interface{} {
		errStr := "Unknown error"
		if len(args) > 0 {
			errStr = args[0].String()
		}
		ctx.Dispatch(func(ctx app.Context) {
			h.generatingXTC = false
			h.errorMsg = "XTC Generation failed: " + errStr
		})
		return nil
	}))
}

func (h *home) Render() app.UI {
	return app.Div().Class("container").Body(
		h.renderHeader(),
		app.Main().Class("app-main").Body(
			h.renderInputSection(),
			h.renderSettings(),
			h.renderConvertButton(),
			h.renderResult(),
		),
		app.If(h.generatingXTC, func() app.UI {
			return h.renderGeneratingOverlay()
		}),
		h.renderFooter(),
	)
}

func (h *home) renderHeader() app.UI {
	return app.Header().Class("app-header").Body(
		app.H1().Class("app-title").Text("md-converter"),
		app.P().Class("app-subtitle").Text("Convert Markdown files to e-ink optimised EPUB or XTC files"),
	)
}

func (h *home) renderInputSection() app.UI {
	return app.Div().Class("controls").Body(
		// Input method tabs
		app.Div().Class("tab-bar").Body(
			app.Button().
				Class(h.tabClass(methodFile)).
				Text("📁 Upload File").
				OnClick(func(ctx app.Context, e app.Event) {
					h.method = methodFile
					ctx.Update()
				}),
			app.Button().
				Class(h.tabClass(methodURL)).
				Text("🔗 Load from URL").
				OnClick(func(ctx app.Context, e app.Event) {
					h.method = methodURL
					ctx.Update()
				}),
		),

		// File upload panel
		app.If(h.method == methodFile, func() app.UI {
			return h.renderDropZone()
		}),

		// URL input panel
		app.If(h.method == methodURL, func() app.UI {
			return h.renderURLInput()
		}),
	)
}

func (h *home) tabClass(m inputMethod) string {
	if h.method == m {
		return "btn btn-tab btn-tab-active"
	}
	return "btn btn-tab"
}

func (h *home) renderDropZone() app.UI {
	dropClass := "drop-zone"
	if h.dragOver {
		dropClass = "drop-zone drag-over"
	}

	label := "Drag & drop your .md file here, or"
	if h.fileName != "" {
		label = "✓ " + h.fileName + " — or choose another file"
	}

	return app.Div().
		Class(dropClass).
		OnDragOver(h.onDragOver).
		OnDragLeave(h.onDragLeave).
		OnDrop(h.onDrop).
		Body(
			app.Div().Class("drop-zone-content").Body(
				app.Div().Class("drop-icon").Text("📂"),
				app.P().Class("drop-label").Text(label),
				app.Label().Class("btn btn-secondary").For("file-input").Text("Browse Files"),
				app.Input().
					ID("file-input").
					Type("file").
					Accept(".md").
					Style("display", "none").
					OnChange(h.onFileChange),
			),
		)
}

func (h *home) renderURLInput() app.UI {
	return app.Div().Class("url-input-section").Body(
		app.Div().Class("form-group").Body(
			app.Label().For("md-url").Text("Direct URL to .md file"),
			app.Div().Class("url-row").Body(
				app.Input().
					ID("md-url").
					Class("form-input").
					Type("url").
					Placeholder("https://example.com/document.md").
					Value(h.fileURL).
					OnChange(func(ctx app.Context, e app.Event) {
						h.fileURL = ctx.JSSrc().Get("value").String()
						ctx.Update()
					}),
				app.Button().
					Class("btn btn-secondary").
					Text("Load").
					Disabled(h.fileURL == "").
					OnClick(h.onLoadURL),
			),
		),
	)
}

func (h *home) renderSettings() app.UI {
	options := make([]app.UI, len(services.DevicePresets))
	for i, p := range services.DevicePresets {
		label := fmt.Sprintf("%s (%dx%d)", p.Name, p.Width, p.Height)
		options[i] = app.Option().
			Value(fmt.Sprintf("%d", i)).
			Text(label).
			Selected(h.presetIndex == i)
	}

	formats := []string{"EPUB", "XTC (1-bit)", "XTCH (2-bit HQ)"}
	formatOptions := make([]app.UI, len(formats))
	for i, f := range formats {
		formatOptions[i] = app.Option().
			Value(fmt.Sprintf("%d", i)).
			Text(f).
			Selected(h.formatIndex == i)
	}

	return app.Div().Class("settings-section").Body(
		app.Div().Class("form-group").Body(
			app.Label().For("device-preset").Body(
				app.Span().Text("📱 E-Ink Device Preset"),
			),
			app.Select().
				ID("device-preset").
				Class("form-select").
				OnChange(h.onPresetChange).
				Body(options...),
		),
		app.Div().Class("form-group").Body(
			app.Label().For("output-format").Body(
				app.Span().Text("📄 Output Format"),
			),
			app.Select().
				ID("output-format").
				Class("form-select").
				OnChange(h.onFormatChange).
				Body(formatOptions...),
		),
		app.Div().Class("form-group").Body(
			app.Label().Class("checkbox-label").Body(
				app.Input().
					Type("checkbox").
					Checked(h.landscape).
					OnChange(func(ctx app.Context, e app.Event) {
						h.landscape = ctx.JSSrc().Get("checked").Bool()
						ctx.Update()
					}),
				app.Span().Text(" 🔄 Landscape Orientation"),
			),
		),
	)
}

func (h *home) renderConvertButton() app.UI {
	hasInput := len(h.fileData) > 0
	buttonText := "Convert Document"
	if h.converting {
		buttonText = "Converting…"
	}

	var statusEl app.UI = app.Div()
	if h.statusMsg != "" && h.errorMsg == "" {
		statusEl = app.P().Class("status-msg").Text(h.statusMsg)
	}
	if h.errorMsg != "" {
		statusEl = app.P().Class("error-msg").Text("⚠ " + h.errorMsg)
	}

	return app.Div().Class("convert-section").Body(
		app.Button().
			Class("btn btn-primary btn-convert").
			Text(buttonText).
			Disabled(!hasInput || h.converting).
			OnClick(h.onConvert),
		statusEl,
	)
}

func (h *home) renderResult() app.UI {
	if !h.converted {
		return app.Div()
	}

	title := "Document Processed"
	if h.formatIndex == 0 {
		title = "Conversion Complete"
	}

	btnText := "⬇ Download " + h.epubName
	if h.formatIndex != 0 {
		formatName := "XTC"
		if h.formatIndex == 2 {
			formatName = "XTCH"
		}
		btnText = "⚙ Generate & Download " + formatName
	}

	var statusRow app.UI = app.Div()
	if h.formatIndex != 0 && h.xtcComplete {
		statusRow = app.Div().Class("stat-badge stat-badge-ok").Style("margin-top", "1rem").Body(
			app.Span().Class("stat-label").Text("Image Generation"),
			app.Span().Class("stat-value").Text("✓ Complete ("+h.xtcExt+")"),
		)
	}

	return app.Div().Class("result-panel").Body(
		app.Div().Class("result-header").Body(
			app.Span().Class("result-icon").Text("✅"),
			app.H2().Class("result-title").Text(title),
		),
		app.Div().Class("result-stats").Body(
			app.Div().Class("stat-badge").Body(
				app.Span().Class("stat-label").Text("Sections"),
				app.Span().Class("stat-value").Text(fmt.Sprintf("%d", h.sectionCount)),
			),
			app.Div().Class("stat-badge").Body(
				app.Span().Class("stat-label").Text("Pages"),
				app.Span().Class("stat-value").Text(fmt.Sprintf("%d", h.sectionCount)),
			),
			app.Div().Class("stat-badge stat-badge-ok").Body(
				app.Span().Class("stat-label").Text("Validation"),
				app.Span().Class("stat-value").Text("✓ Counts match"),
			),
		),
		statusRow,
		app.Button().
			Class(h.actionBtnClass()).
			Text(btnText).
			OnClick(h.onDownload),
	)
}

func (h *home) actionBtnClass() string {
	if h.formatIndex != 0 && h.xtcComplete {
		// If XTCH is done, button is a success button again asking them if they want to re-download maybe?
		// Actually if it's done, downloading again is fine.
		return "btn btn-success btn-download"
	} else if h.formatIndex != 0 {
		return "btn btn-primary btn-download" // Primary visual to signify there's work left
	}
	return "btn btn-success btn-download"
}

func (h *home) renderGeneratingOverlay() app.UI {
	return app.Div().Class("overlay").Style("position", "fixed").
		Style("top", "0").Style("left", "0").Style("width", "100vw").Style("height", "100vh").
		Style("background", "rgba(0,0,0,0.8)").
		Style("display", "flex").Style("flex-direction", "column").
		Style("align-items", "center").Style("justify-content", "center").
		Style("z-index", "9999").Body(
		app.Div().Class("spinner").Text("⏳").Style("font-size", "4rem").Style("margin-bottom", "1rem"),
		app.H2().Style("color", "white").Text("Generating XTC images..."),
		app.P().Style("color", "#ccc").Text("This might take a minute relying on your hardware. Please wait."),
	)
}

func (h *home) renderFooter() app.UI {
	return app.Footer().Class("app-footer").Body(
		app.P().Body(
			app.Span().Text("⚡ "),
			app.Strong().Text("Fast & Private"),
			app.Span().Text(" — your Markdown files are processed entirely in your browser and never leave your device"),
		),
		app.P().Class("footer-credit").Text("Built with Go + WebAssembly using go-app"),
	)
}

// ── Event Handlers ──────────────────────────────────────────────────────────

func (h *home) onDragOver(ctx app.Context, e app.Event) {
	e.PreventDefault()
	if !h.dragOver {
		h.dragOver = true
		ctx.Update()
	}
}

func (h *home) onDragLeave(ctx app.Context, e app.Event) {
	h.dragOver = false
	ctx.Update()
}

func (h *home) onDrop(ctx app.Context, e app.Event) {
	e.PreventDefault()
	h.dragOver = false
	ctx.Update()

	files := e.Get("dataTransfer").Get("files")
	if files.Length() == 0 {
		return
	}
	file := files.Index(0)
	app.Window().Call("readFileAsBase64", file)
}

func (h *home) onFileChange(ctx app.Context, e app.Event) {
	files := ctx.JSSrc().Get("files")
	if files.Length() == 0 {
		return
	}
	file := files.Index(0)
	app.Window().Call("readFileAsBase64", file)
}

func (h *home) onLoadURL(ctx app.Context, e app.Event) {
	if h.fileURL == "" {
		return
	}
	h.statusMsg = "Fetching from URL…"
	h.errorMsg = ""
	ctx.Update()

	url := h.fileURL
	ctx.Async(func() {
		result := app.Window().Call("fetchURLAsBase64", url)
		// The JS promise resolves via onFileRead callback — nothing more to do here.
		_ = result
	})
}

func (h *home) onPresetChange(ctx app.Context, e app.Event) {
	val := ctx.JSSrc().Get("value").String()
	for i, p := range services.DevicePresets {
		if fmt.Sprintf("%d", i) == val {
			h.presetIndex = i
			_ = p
			break
		}
	}
	ctx.Update()
}

func (h *home) onFormatChange(ctx app.Context, e app.Event) {
	val := ctx.JSSrc().Get("value").String()
	for i := range []string{"EPUB", "XTC", "XTCH"} {
		if fmt.Sprintf("%d", i) == val {
			h.formatIndex = i
			break
		}
	}
	ctx.Update()
}

func (h *home) onConvert(ctx app.Context, e app.Event) {
	if len(h.fileData) == 0 {
		return
	}
	h.converting = true
	h.converted = false
	h.xtcComplete = false
	h.errorMsg = ""
	h.statusMsg = "Converting…"
	ctx.Update()

	data := h.fileData
	preset := services.DevicePresets[h.presetIndex]
	title := strings.TrimSuffix(h.fileName, ".md")
	if title == "" {
		title = "Markdown Document"
	}

	ctx.Async(func() {
		result, err := services.Convert(data, preset, title)
		ctx.Dispatch(func(ctx app.Context) {
			h.converting = false
			if err != nil {
				h.errorMsg = err.Error()
				h.statusMsg = ""
				return
			}
			if valErr := services.ValidateSectionCount(result); valErr != nil {
				h.errorMsg = valErr.Error()
				h.statusMsg = ""
				return
			}
			h.converted = true
			h.sectionCount = result.SectionCount
			h.epubData = result.EPUBData
			h.epubName = title + ".epub"
			h.statusMsg = ""
			h.errorMsg = ""
		})
	})
}

func (h *home) onDownload(ctx app.Context, e app.Event) {
	if len(h.epubData) == 0 {
		return
	}
	b64 := base64.StdEncoding.EncodeToString(h.epubData)

	if h.formatIndex == 0 { // EPUB
		app.Window().Call("downloadEPUB", b64, h.epubName)
	} else { // XTC or XTCH
		format := "xtc"
		if h.formatIndex == 2 {
			format = "xtch"
		}
		preset := services.DevicePresets[h.presetIndex]
		title := strings.TrimSuffix(h.epubName, ".epub")

		// Remove the old browser alert and instead use Go state for overlay
		h.generatingXTC = true
		ctx.Update()

		ctx.Async(func() {
			app.Window().Call("convertEpubToXtc", b64, format, preset.Width, preset.Height, title, h.landscape)
		})
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func formatBytes(n int) string {
	switch {
	case n >= 1024*1024:
		return fmt.Sprintf("%.1f MB", float64(n)/(1024*1024))
	case n >= 1024:
		return fmt.Sprintf("%.1f KB", float64(n)/1024)
	default:
		return fmt.Sprintf("%d B", n)
	}
}
