package main

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"xteink-wallpaper-converter/internal/services"

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
		Name:        "XTeink Wallpaper Converter",
		Description: "Convert images to BMP format for XTeink X4 ereader wallpapers",
		Author:      "James Tooze",
		Keywords:    []string{"XTeink", "Wallpaper", "Ereader", "BMP", "Converter", "WASM", "Go"},
		Styles: []string{
			"/static/app.css",
		},
		Icon: app.Icon{
			Default: "/static/icon.png",
		},
		Scripts: []string{
			"/static/app.js",
		},
		StartURL:  "/xteink-wallpaper-converter/",
		Resources: app.PrefixedLocation("/xteink-wallpaper-converter"),
		Version:   version,
	})
	if err != nil {
		fmt.Println(err)
	}
}

type home struct {
	app.Compo

	imageCount   int
	imagesLoaded int
	imagesFailed int
	processing   bool
	processed    bool
	resultImage  string
	resultZip    string
	errorMsg     string
	progress     int

	isDirectoryUpload bool
	filenames         []string
	imageFiles        [][]byte

	// Crop selection
	cropX        int
	cropY        int
	cropWidth    int
	cropHeight   int
	showCrop     bool
	previewImage []byte
}

func (h *home) OnMount(ctx app.Context) {
	app.Window().Set("onImagesLoaded", app.FuncOf(func(this app.Value, args []app.Value) interface{} {
		if len(args) < 2 {
			return nil
		}
		count := args[0].Int()
		isDir := args[1].Bool()
		ctx.Dispatch(func(ctx app.Context) {
			h.imageCount = count
			h.imagesLoaded = 0
			h.imagesFailed = 0
			h.isDirectoryUpload = isDir
			h.imageFiles = make([][]byte, count)
			h.filenames = make([]string, count)
		})
		return nil
	}))

	app.Window().Set("onImageData", app.FuncOf(func(this app.Value, args []app.Value) interface{} {
		if len(args) < 3 {
			return nil
		}
		idx := args[0].Int()
		filename := args[1].String()
		b64 := args[2].String()
		data, err := base64.StdEncoding.DecodeString(b64)
		if err != nil {
			return nil
		}
		ctx.Dispatch(func(ctx app.Context) {
			if idx >= len(h.imageFiles) {
				return
			}
			h.imagesLoaded++
			h.imageFiles[idx] = data
			h.filenames[idx] = filename

			// Generate preview image for crop selection (single image only)
			if idx == 0 && len(h.imageFiles) == 1 {
				previewData, err := services.CreateImagePreview(data, 600, 400)
				if err == nil {
					h.previewImage = previewData
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

	app.Window().Set("onCropSelection", app.FuncOf(func(this app.Value, args []app.Value) interface{} {
		if len(args) < 4 {
			return nil
		}
		previewCropX := args[0].Int()
		previewCropY := args[1].Int()
		previewCropWidth := args[2].Int()
		previewCropHeight := args[3].Int()
		ctx.Dispatch(func(ctx app.Context) {
			if len(h.imageFiles) > 0 && len(h.previewImage) > 0 {
				// Get original image dimensions
				origImg, _, err := image.Decode(bytes.NewReader(h.imageFiles[0]))
				if err == nil {
					origBounds := origImg.Bounds()
					origWidth := origBounds.Dx()
					origHeight := origBounds.Dy()

					// Get preview image dimensions
					previewImg, _, err := image.Decode(bytes.NewReader(h.previewImage))
					if err == nil {
						previewBounds := previewImg.Bounds()
						previewWidth := previewBounds.Dx()
						previewHeight := previewBounds.Dy()

						// Calculate scaling factors
						scaleX := float64(origWidth) / float64(previewWidth)
						scaleY := float64(origHeight) / float64(previewHeight)

						// Scale crop coordinates back to original image
						h.cropX = int(float64(previewCropX) * scaleX)
						h.cropY = int(float64(previewCropY) * scaleY)
						h.cropWidth = int(float64(previewCropWidth) * scaleX)
						h.cropHeight = int(float64(previewCropHeight) * scaleY)
					}
				}
			}
		})
		return nil
	}))

	app.Window().Set("onProcessingDone", app.FuncOf(func(this app.Value, args []app.Value) interface{} {
		if len(args) < 3 {
			return nil
		}
		b64 := args[0].String()
		zipB64 := args[1].String()
		errMsg := args[2].String()
		ctx.Dispatch(func(ctx app.Context) {
			h.processing = false
			h.progress = 0
			if errMsg != "" {
				h.errorMsg = errMsg
				return
			}
			h.resultImage = b64
			h.resultZip = zipB64
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
		app.H1().Class("app-title").Text("XTeink Wallpaper Converter"),
		app.P().Class("app-subtitle").Text("Convert images to BMP format for XTeink X4 ereader wallpapers"),
	)
}

func (h *home) renderDropZone() app.UI {
	return app.Div().Class("controls").Body(
		app.Div().Class("drop-zone").ID("drop-zone").Body(
			app.Div().Class("drop-zone-content").Body(
				app.Div().Class("drop-icon").Text("📷"),
				app.P().Class("drop-label").Text("Drop images or a directory here, or click to select"),
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
			uploadType := "images"
			if h.isDirectoryUpload {
				uploadType = "directory"
			}
			return app.P().Class("status-msg").Text(fmt.Sprintf("Loaded %d %s (%d failed)", h.imagesLoaded, uploadType, h.imagesFailed))
		}),
	)
}

func (h *home) renderSettings() app.UI {
	return app.Div().Class("settings-section").Body(
		app.P().Class("settings-info").Text("Images will be converted to 480x800 BMP format for XTeink X4 ereader wallpapers"),
		app.If(h.imageCount == 1 && h.imagesLoaded == 1, func() app.UI {
			return app.Div().Class("crop-section").Body(
				app.Div().Class("form-group checkbox-group").Body(
					app.Label().Class("checkbox-label").Body(
						app.Input().Type("checkbox").Checked(h.showCrop).OnChange(h.onShowCropChange),
						app.Span().Text("Enable custom crop selection"),
					),
				),
				app.If(h.showCrop && len(h.previewImage) > 0, func() app.UI {
					return app.Div().Class("crop-preview").Body(
						app.Div().Class("crop-instructions").Body(
							app.P().Text("Drag to select the area to use as wallpaper (480x800 aspect ratio)"),
						),
						app.Div().Class("image-preview-container").Body(
							app.Img().
								Src("data:image/jpeg;base64,"+base64.StdEncoding.EncodeToString(h.previewImage)).
								Class("preview-image").
								ID("preview-image"),
							app.Div().
								Class("crop-selection").
								ID("crop-selection").
								Style("display", "none"),
						),
					)
				}),
			)
		}),
	)
}

func (h *home) renderGenerateButton() app.UI {
	buttonText := "Convert to Wallpaper"
	if h.processing {
		buttonText = "Converting..."
	}

	var statusEl app.UI = app.Div()
	if h.errorMsg != "" {
		statusEl = app.P().Class("error-msg").Text("⚠ " + h.errorMsg)
	}

	return app.Div().Class("convert-section").Body(
		app.Button().
			Class("btn btn-primary btn-convert").
			Text(buttonText).
			Disabled(h.imageCount == 0 || h.processing || h.imagesLoaded == 0 || h.imagesLoaded < h.imageCount).
			OnClick(h.onGenerate),
		statusEl,
	)
}

func (h *home) renderResult() app.UI {
	if !h.processed {
		return app.Div()
	}

	if h.resultZip != "" {
		// Directory upload - show zip download
		return app.Div().Class("result-panel").Body(
			app.Div().Class("result-header").Body(
				app.Span().Class("result-icon").Text("✅"),
				app.H2().Class("result-title").Text("Wallpapers Converted"),
			),
			app.P().Class("result-info").Text(fmt.Sprintf("Converted %d images to BMP format", h.imageCount)),
			app.Button().
				Class("btn btn-success btn-download").
				Text("⬇ Download Wallpapers (sleep.zip)").
				OnClick(h.onDownloadZip),
		)
	} else if h.resultImage != "" {
		// Single image - show preview and download
		return app.Div().Class("result-panel").Body(
			app.Div().Class("result-header").Body(
				app.Span().Class("result-icon").Text("✅"),
				app.H2().Class("result-title").Text("Wallpaper Converted"),
			),
			app.P().Class("result-info").Text("Converted to 480x800 BMP format"),
			app.Button().
				Class("btn btn-success btn-download").
				Text("⬇ Download Wallpaper").
				OnClick(h.onDownload),
		)
	}

	return app.Div()
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
	h.filenames = nil
	h.isDirectoryUpload = false
	h.processed = false
	h.resultImage = ""
	h.resultZip = ""
	h.cropX = 0
	h.cropY = 0
	h.cropWidth = 0
	h.cropHeight = 0
	h.previewImage = nil
	ctx.Update()

	app.Window().Call("loadImages", files)
}

func (h *home) onShowCropChange(ctx app.Context, e app.Event) {
	h.showCrop = ctx.JSSrc().Get("checked").Bool()
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
	h.resultZip = ""
	h.progress = 0
	ctx.Update()

	ctx.Async(func() {
		var resultB64 string
		var resultZipB64 string
		var errMsg string

		if h.isDirectoryUpload || h.imageCount > 1 {
			// Create zip file for multiple images
			zipData, err := services.CreateWallpaperZip(h.imageFiles, h.filenames)
			if err != nil {
				errMsg = err.Error()
			} else {
				resultZipB64 = base64.StdEncoding.EncodeToString(zipData)
			}
		} else {
			// Convert single image
			bmpData, err := services.ConvertImageToWallpaper(h.imageFiles[0], h.cropX, h.cropY, h.cropWidth, h.cropHeight)
			if err != nil {
				errMsg = err.Error()
			} else {
				resultB64 = base64.StdEncoding.EncodeToString(bmpData)
			}
		}

		app.Window().Call("onProcessingDone", resultB64, resultZipB64, errMsg)
	})
}

func (h *home) onDownload(ctx app.Context, e app.Event) {
	if h.resultImage == "" {
		return
	}
	filename := "wallpaper.bmp"
	if len(h.filenames) > 0 && h.filenames[0] != "" {
		ext := filepath.Ext(h.filenames[0])
		name := strings.TrimSuffix(h.filenames[0], ext)
		filename = name + ".bmp"
	}
	app.Window().Call("downloadImage", h.resultImage, filename, "image/bmp")
}

func (h *home) onDownloadZip(ctx app.Context, e app.Event) {
	if h.resultZip == "" {
		return
	}
	app.Window().Call("downloadImage", h.resultZip, "sleep.zip", "application/zip")
}
