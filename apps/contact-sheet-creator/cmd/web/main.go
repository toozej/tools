package main

import (
	"encoding/base64"
	"fmt"
	"strconv"
	"time"

	"contact-sheet-creator/internal/services"

	"github.com/maxence-charriere/go-app/v10/pkg/app"
)

// buildVersion can be overridden at build time with:
// -ldflags "-X main.buildVersion=<version>"
var buildVersion = "dev"

const filmDetectMaxAttempts = 3

func staticSiteVersion() string {
	if buildVersion != "" && buildVersion != "dev" {
		return buildVersion
	}
	// Fallback for local/dev builds to ensure service worker cache invalidates
	// whenever a new static bundle is generated.
	return strconv.FormatInt(time.Now().Unix(), 10)
}

func main() {
	app.Route("/", func() app.Composer { return &home{} })
	app.RunWhenOnBrowser()

	version := staticSiteVersion()
	fmt.Println("Generating static website with version:", version)

	err := app.GenerateStaticWebsite(".", &app.Handler{
		Name:        "Contact Sheet Creator",
		Description: "Create digital contact sheets from your photos",
		Author:      "James Tooze",
		Keywords:    []string{"Contact Sheet", "Film", "Photography", "WASM", "Go"},
		Styles: []string{
			"/static/app.css",
		},
		Icon: app.Icon{
			Default: "/static/icon.png",
		},
		Scripts: []string{
			"/static/app.js",
		},
		StartURL:  "/contact-sheet-creator/",
		Resources: app.PrefixedLocation("/contact-sheet-creator"),
		Version:   version,
	})
	if err != nil {
		fmt.Println(err)
	}
}

type home struct {
	app.Compo

	imageCount     int
	imagesLoaded   int
	imagesFailed   int
	processing     bool
	processed      bool
	resultImage    string
	errorMsg       string
	progress       int
	filmDetectDone bool
	filmDetectTry  int

	orientation int
	rows        int
	cols        int
	sheetWidth  int
	sheetHeight int
	imageWidth  int
	imageHeight int
	headerText  string
	footerText  string
	filmStrip   bool
	filmType    string

	detectedFilm string
	imageFiles   [][]byte
}

func (h *home) OnMount(ctx app.Context) {
	h.rows = 8
	h.cols = 6
	h.imageWidth = 300
	h.imageHeight = 200
	h.orientation = 0
	h.filmStrip = true

	app.Window().Set("onImagesLoaded", app.FuncOf(func(this app.Value, args []app.Value) interface{} {
		if len(args) < 1 {
			return nil
		}
		count := args[0].Int()
		ctx.Dispatch(func(ctx app.Context) {
			h.imageCount = count
			h.imagesLoaded = 0
			h.imagesFailed = 0
			h.rows = (count + h.cols - 1) / h.cols
		})
		return nil
	}))

	app.Window().Set("onImageData", app.FuncOf(func(this app.Value, args []app.Value) interface{} {
		if len(args) < 2 {
			return nil
		}
		idx := args[0].Int()
		b64 := args[1].String()
		data, err := base64.StdEncoding.DecodeString(b64)
		if err != nil {
			return nil
		}
		ctx.Dispatch(func(ctx app.Context) {
			if idx >= len(h.imageFiles) {
				h.imageFiles = append(h.imageFiles, make([][]byte, idx-len(h.imageFiles)+1)...)
			}
			if len(h.imageFiles[idx]) == 0 {
				h.imagesLoaded++
			}
			h.imageFiles[idx] = data

			if !h.filmDetectDone && h.filmDetectTry < filmDetectMaxAttempts {
				h.filmDetectTry++
				filmType := services.DetectFilmType(data)
				if filmType != "" && h.detectedFilm == "" {
					h.detectedFilm = string(filmType)
					h.filmDetectDone = true
				} else if h.filmDetectTry >= filmDetectMaxAttempts {
					h.filmDetectDone = true
				}
			}
		})
		return nil
	}))

	app.Window().Set("onImageLoadError", app.FuncOf(func(this app.Value, args []app.Value) interface{} {
		ctx.Dispatch(func(ctx app.Context) {
			h.imagesFailed++
		})
		return nil
	}))

	app.Window().Set("onProcessingDone", app.FuncOf(func(this app.Value, args []app.Value) interface{} {
		if len(args) < 2 {
			return nil
		}
		b64 := args[0].String()
		errMsg := args[1].String()
		ctx.Dispatch(func(ctx app.Context) {
			h.processing = false
			h.progress = 0
			if errMsg != "" {
				h.errorMsg = errMsg
				return
			}
			h.resultImage = b64
			h.processed = true
		})
		return nil
	}))

	app.Window().Set("onProgressUpdate", app.FuncOf(func(this app.Value, args []app.Value) interface{} {
		if len(args) < 1 {
			return nil
		}
		progress := args[0].Int()
		ctx.Dispatch(func(ctx app.Context) {
			h.progress = progress
		})
		return nil
	}))
}

func (h *home) Render() app.UI {
	return app.Div().Class("container").Body(
		h.renderHeader(),
		app.Main().Class("app-main").Body(
			h.renderDropZone(),
			h.renderSettings(),
			h.renderGenerateButton(),
			h.renderResult(),
		),
		h.renderFooter(),
	)
}

func (h *home) renderHeader() app.UI {
	return app.Header().Class("app-header").Body(
		app.H1().Class("app-title").Text("Contact Sheet Creator"),
		app.P().Class("app-subtitle").Text("Create digital contact sheets like a film contact sheet"),
	)
}

func (h *home) renderDropZone() app.UI {
	return app.Div().Class("controls").Body(
		app.Div().Class("drop-zone").ID("drop-zone").Body(
			app.Div().Class("drop-zone-content").Body(
				app.Div().Class("drop-icon").Text("📷"),
				app.P().Class("drop-label").Text("Drop images here or click to select"),
				app.Label().Class("btn btn-secondary").For("file-input").Text("Browse Files"),
				app.Input().
					ID("file-input").
					Type("file").
					Accept("image/*").
					Multiple(true).
					Style("display", "none").
					OnChange(h.onFileChange),
			),
		),
		app.If(h.imageCount > 0, func() app.UI {
			return app.P().Class("status-msg").Text(fmt.Sprintf("%d/%d images loaded (%d failed)", h.imagesLoaded, h.imageCount, h.imagesFailed))
		}),
	)
}

func (h *home) renderSettings() app.UI {
	orientations := services.GetOrientations()
	orientationOptions := make([]app.UI, len(orientations))
	for i, o := range orientations {
		orientationOptions[i] = app.Option().Value(strconv.Itoa(int(o.ID))).Text(o.Name).Selected(h.orientation == int(o.ID))
	}

	filmTypes := services.GetFilmTypes()

	filmOptions := make([]app.UI, len(filmTypes))
	for i, ft := range filmTypes {
		selected := false
		if h.filmType != "" && h.filmType == ft {
			selected = true
		} else if h.filmType == "" && h.detectedFilm != "" && h.detectedFilm == ft {
			selected = true
		}
		filmOptions[i] = app.Option().Value(ft).Text(ft).Selected(selected)
	}

	return app.Div().Class("settings-section").Body(
		app.Div().Class("settings-row").Body(
			app.Div().Class("form-group").Body(
				app.Label().For("orientation").Text("Image Orientation"),
				app.Select().ID("orientation").Class("form-select").OnChange(h.onOrientationChange).Body(orientationOptions...),
			),
			app.Div().Class("form-group").Body(
				app.Label().For("rows").Text("Rows"),
				app.Input().ID("rows").Class("form-input").Type("number").Value(strconv.Itoa(h.rows)).Min("1").Max("20").OnChange(h.onRowsChange),
			),
			app.Div().Class("form-group").Body(
				app.Label().For("cols").Text("Columns"),
				app.Input().ID("cols").Class("form-input").Type("number").Value(strconv.Itoa(h.cols)).Min("1").Max("20").OnChange(h.onColsChange),
			),
		),
		app.Div().Class("settings-row").Body(
			app.Div().Class("form-group").Body(
				app.Label().For("image-width").Text("Image Width (px)"),
				app.Input().ID("image-width").Class("form-input").Type("number").Value(strconv.Itoa(h.imageWidth)).Min("50").Max("1000").OnChange(h.onImageWidthChange),
			),
			app.Div().Class("form-group").Body(
				app.Label().For("image-height").Text("Image Height (px)"),
				app.Input().ID("image-height").Class("form-input").Type("number").Value(strconv.Itoa(h.imageHeight)).Min("50").Max("1000").OnChange(h.onImageHeightChange),
			),
		),
		app.Div().Class("settings-row").Body(
			app.Div().Class("form-group").Body(
				app.Label().For("sheet-width").Text("Sheet Width (px, 0=auto)"),
				app.Input().ID("sheet-width").Class("form-input").Type("number").Value(strconv.Itoa(h.sheetWidth)).Min("0").Max("10000").OnChange(h.onSheetWidthChange),
			),
			app.Div().Class("form-group").Body(
				app.Label().For("sheet-height").Text("Sheet Height (px, 0=auto)"),
				app.Input().ID("sheet-height").Class("form-input").Type("number").Value(strconv.Itoa(h.sheetHeight)).Min("0").Max("10000").OnChange(h.onSheetHeightChange),
			),
		),
		app.Div().Class("settings-row").Body(
			app.Div().Class("form-group").Body(
				app.Label().For("header-text").Text("Header Text"),
				app.Input().ID("header-text").Class("form-input").Type("text").Placeholder("Contact Sheet").Value(h.headerText).OnChange(h.onHeaderChange),
			),
			app.Div().Class("form-group").Body(
				app.Label().For("footer-text").Text("Footer Text"),
				app.Input().ID("footer-text").Class("form-input").Type("text").Placeholder("2024").Value(h.footerText).OnChange(h.onFooterChange),
			),
		),
		app.Div().Class("settings-row").Body(
			app.Div().Class("form-group checkbox-group").Body(
				app.Label().Class("checkbox-label").Body(
					app.Input().Type("checkbox").Checked(h.filmStrip).OnChange(h.onFilmStripChange),
					app.Span().Text("Film Strip Border"),
				),
			),
			app.If(h.filmStrip, func() app.UI {
				return app.Div().Class("form-group").Body(
					app.Label().For("film-type").Text("Film Type"),
					app.Select().ID("film-type").Class("form-select").OnChange(h.onFilmTypeChange).Body(filmOptions...),
				)
			}),
		),
		app.If(h.detectedFilm != "", func() app.UI {
			return app.P().Class("status-msg").Text(fmt.Sprintf("Detected film: %s", h.detectedFilm))
		}),
	)
}

func (h *home) renderGenerateButton() app.UI {
	buttonText := "Generate Contact Sheet"
	if h.processing {
		buttonText = "Processing..."
	}

	var statusEl app.UI = app.Div()
	if h.errorMsg != "" {
		statusEl = app.P().Class("error-msg").Text("⚠ " + h.errorMsg)
	}

	var progressBar app.UI = app.Div()
	if h.processing && h.progress > 0 {
		progressBar = app.Div().Class("progress-container").Body(
			app.Div().Class("progress-bar").Style("width", strconv.Itoa(h.progress)+"%"),
			app.P().Class("progress-text").Text("Processing: "+strconv.Itoa(h.progress)+"%"),
		)
	}

	return app.Div().Class("convert-section").Body(
		app.Button().
			Class("btn btn-primary btn-convert").
			Text(buttonText).
			Disabled(h.imageCount == 0 || h.processing || h.imagesLoaded == 0 || h.imagesLoaded < h.imageCount).
			OnClick(h.onGenerate),
		statusEl,
		progressBar,
	)
}

func (h *home) renderResult() app.UI {
	if !h.processed || h.resultImage == "" {
		return app.Div()
	}

	return app.Div().Class("result-panel").Body(
		app.Div().Class("result-header").Body(
			app.Span().Class("result-icon").Text("✅"),
			app.H2().Class("result-title").Text("Contact Sheet Created"),
		),
		app.Div().Class("result-image-container").Body(
			app.Img().Src("data:image/jpeg;base64,"+h.resultImage).Class("result-image"),
		),
		app.Button().
			Class("btn btn-success btn-download").
			Text("⬇ Download Contact Sheet").
			OnClick(h.onDownload),
	)
}

func (h *home) renderFooter() app.UI {
	return app.Footer().Class("app-footer").Body(
		app.P().Class("footer-credit").Text("Built with Go + WebAssembly using go-app"),
	)
}

func (h *home) onFileChange(ctx app.Context, e app.Event) {
	files := ctx.JSSrc().Get("files")
	if files.Length() == 0 {
		return
	}
	h.imageCount = 0
	h.imagesLoaded = 0
	h.imagesFailed = 0
	h.imageFiles = nil
	h.detectedFilm = ""
	h.filmDetectDone = false
	h.filmDetectTry = 0
	h.processed = false
	h.resultImage = ""
	ctx.Update()

	app.Window().Call("loadImages", files)
}

func (h *home) onOrientationChange(ctx app.Context, e app.Event) {
	h.orientation, _ = strconv.Atoi(ctx.JSSrc().Get("value").String())
	ctx.Update()
}

func (h *home) onRowsChange(ctx app.Context, e app.Event) {
	val, _ := strconv.Atoi(ctx.JSSrc().Get("value").String())
	if val > 0 {
		h.rows = val
	}
	ctx.Update()
}

func (h *home) onColsChange(ctx app.Context, e app.Event) {
	val, _ := strconv.Atoi(ctx.JSSrc().Get("value").String())
	if val > 0 {
		h.cols = val
	}
	ctx.Update()
}

func (h *home) onImageWidthChange(ctx app.Context, e app.Event) {
	val, _ := strconv.Atoi(ctx.JSSrc().Get("value").String())
	if val > 0 {
		h.imageWidth = val
	}
	ctx.Update()
}

func (h *home) onImageHeightChange(ctx app.Context, e app.Event) {
	val, _ := strconv.Atoi(ctx.JSSrc().Get("value").String())
	if val > 0 {
		h.imageHeight = val
	}
	ctx.Update()
}

func (h *home) onSheetWidthChange(ctx app.Context, e app.Event) {
	val, _ := strconv.Atoi(ctx.JSSrc().Get("value").String())
	h.sheetWidth = val
	ctx.Update()
}

func (h *home) onSheetHeightChange(ctx app.Context, e app.Event) {
	val, _ := strconv.Atoi(ctx.JSSrc().Get("value").String())
	h.sheetHeight = val
	ctx.Update()
}

func (h *home) onHeaderChange(ctx app.Context, e app.Event) {
	h.headerText = ctx.JSSrc().Get("value").String()
	ctx.Update()
}

func (h *home) onFooterChange(ctx app.Context, e app.Event) {
	h.footerText = ctx.JSSrc().Get("value").String()
	ctx.Update()
}

func (h *home) onFilmStripChange(ctx app.Context, e app.Event) {
	h.filmStrip = ctx.JSSrc().Get("checked").Bool()
	ctx.Update()
}

func (h *home) onFilmTypeChange(ctx app.Context, e app.Event) {
	h.filmType = ctx.JSSrc().Get("value").String()
	ctx.Update()
}

func (h *home) onGenerate(ctx app.Context, e app.Event) {
	if h.imageCount == 0 || len(h.imageFiles) == 0 {
		return
	}

	if h.imagesLoaded < h.imageCount {
		h.errorMsg = fmt.Sprintf("still loading images: %d/%d", h.imagesLoaded, h.imageCount)
		ctx.Update()
		return
	}

	h.processing = true
	h.errorMsg = ""
	h.processed = false
	h.resultImage = ""
	h.progress = 0
	ctx.Update()

	filmType := services.FilmType(h.filmType)
	if filmType == "None" {
		filmType = ""
	}
	if filmType == "" && h.detectedFilm != "" {
		filmType = services.FilmType(h.detectedFilm)
	}

	settings := services.SheetSettings{
		Orientation: services.Orientation(h.orientation),
		Rows:        h.rows,
		Cols:        h.cols,
		SheetWidth:  h.sheetWidth,
		SheetHeight: h.sheetHeight,
		ImageWidth:  h.imageWidth,
		ImageHeight: h.imageHeight,
		HeaderText:  h.headerText,
		FooterText:  h.footerText,
		FilmStrip:   h.filmStrip,
		FilmType:    filmType,
	}

	progressCb := func(current, total int) {
		if total > 0 {
			progress := (current * 100) / total
			app.Window().Call("onProgressUpdate", progress)
		}
	}

	ctx.Async(func() {
		result, err := services.CreateContactSheet(h.imageFiles, settings, progressCb)
		var resultB64 string
		var errMsg string
		if err != nil {
			errMsg = err.Error()
		} else {
			resultB64 = base64.StdEncoding.EncodeToString(result)
		}
		app.Window().Call("onProcessingDone", resultB64, errMsg)
	})
}

func (h *home) onDownload(ctx app.Context, e app.Event) {
	if h.resultImage == "" {
		return
	}
	app.Window().Call("downloadImage", h.resultImage, "contact-sheet.jpg")
}
