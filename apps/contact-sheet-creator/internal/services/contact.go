package services

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"math"
	"sort"
	"strings"
	"time"

	_ "embed"

	"github.com/anthonynsimon/bild/transform"
	exif3 "github.com/dsoprea/go-exif/v3"
	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
	_ "golang.org/x/image/tiff"
)

type Orientation int

const (
	OrientationLandscape Orientation = iota
	OrientationPortrait
)

func (o Orientation) String() string {
	switch o {
	case OrientationLandscape:
		return "Landscape (35mm style)"
	case OrientationPortrait:
		return "Portrait (Half-frame style)"
	default:
		return "Unknown"
	}
}

type OrientationInfo struct {
	ID   Orientation
	Name string
}

func GetOrientations() []OrientationInfo {
	return []OrientationInfo{
		{OrientationLandscape, OrientationLandscape.String()},
		{OrientationPortrait, OrientationPortrait.String()},
	}
}

type FilmType string

const (
	FilmNone FilmType = ""
)

type FilmCategory string

const (
	FilmCategoryNone          FilmCategory = ""
	FilmCategoryBW            FilmCategory = "bw"
	FilmCategoryColorNegative FilmCategory = "color_negative"
	FilmCategoryColorSlide    FilmCategory = "color_slide"
)

type BorderPosition int

const (
	BorderPositionMiddle BorderPosition = iota
	BorderPositionStart
	BorderPositionEnd
	BorderPositionSingle
)

type FilmDefinition struct {
	Name           string
	Category       FilmCategory
	EdgeprintCodes []string
	LetterCodes    []string
	Keywords       []string
	BorderColor    color.RGBA
	PerfColor      color.RGBA
}

var FilmDefinitions = map[FilmType]FilmDefinition{}

type filmKeyword struct {
	filmType FilmType
	keyword  string
}

var filmKeywords []filmKeyword

//go:embed film_definitions.json
var embeddedFilmDefinitions []byte

type JSONFilmDefinition struct {
	Name           string   `json:"name"`
	Category       string   `json:"category"`
	EdgeprintCodes []string `json:"edgeprint_codes"`
	LetterCodes    []string `json:"letter_codes"`
	Keywords       []string `json:"keywords"`
	BorderColor    RGBA     `json:"border_color"`
	PerfColor      RGBA     `json:"perf_color"`
}

type RGBA struct {
	R uint8 `json:"r"`
	G uint8 `json:"g"`
	B uint8 `json:"b"`
	A uint8 `json:"a"`
}

type JSONFilmData struct {
	Films map[string]JSONFilmDefinition `json:"films"`
}

func init() {
	initializeFilmDefinitions()
}

func initializeFilmDefinitions() {
	var jsonData JSONFilmData
	if err := json.Unmarshal(embeddedFilmDefinitions, &jsonData); err != nil {
		fmt.Println("Error unmarshaling film_definitions.json:", err)
		FilmDefinitions = make(map[FilmType]FilmDefinition)
		filmKeywords = nil
		return
	}

	FilmDefinitions = make(map[FilmType]FilmDefinition)
	filmKeywords = make([]filmKeyword, 0)
	for key, jfd := range jsonData.Films {
		filmType := FilmType(key)
		var cat FilmCategory
		switch jfd.Category {
		case "bw":
			cat = FilmCategoryBW
		case "color_negative":
			cat = FilmCategoryColorNegative
		case "color_slide":
			cat = FilmCategoryColorSlide
		default:
			cat = FilmCategoryNone
		}

		FilmDefinitions[filmType] = FilmDefinition{
			Name:           jfd.Name,
			Category:       cat,
			EdgeprintCodes: jfd.EdgeprintCodes,
			LetterCodes:    jfd.LetterCodes,
			Keywords:       jfd.Keywords,
			BorderColor:    color.RGBA{jfd.BorderColor.R, jfd.BorderColor.G, jfd.BorderColor.B, jfd.BorderColor.A},
			PerfColor:      color.RGBA{jfd.PerfColor.R, jfd.PerfColor.G, jfd.PerfColor.B, jfd.PerfColor.A},
		}

		for _, kw := range jfd.Keywords {
			upperKW := strings.ToUpper(strings.TrimSpace(kw))
			if upperKW == "" {
				continue
			}
			filmKeywords = append(filmKeywords, filmKeyword{filmType: filmType, keyword: upperKW})
		}
	}

	sort.Slice(filmKeywords, func(i, j int) bool {
		if len(filmKeywords[i].keyword) == len(filmKeywords[j].keyword) {
			if filmKeywords[i].keyword == filmKeywords[j].keyword {
				return string(filmKeywords[i].filmType) < string(filmKeywords[j].filmType)
			}
			return filmKeywords[i].keyword < filmKeywords[j].keyword
		}
		return len(filmKeywords[i].keyword) > len(filmKeywords[j].keyword)
	})
}

func GetFilmTypes() []string {
	types := make([]string, 0, len(FilmDefinitions))
	for ft := range FilmDefinitions {
		types = append(types, string(ft))
	}
	sort.Strings(types)
	return append([]string{"None"}, types...)
}

type SheetSettings struct {
	Orientation    Orientation
	Rows           int
	Cols           int
	SheetWidth     int
	SheetHeight    int
	ImageWidth     int
	ImageHeight    int
	HeaderText     string
	FooterText     string
	FilmStrip      bool
	FilmType       FilmType
	FilmBorderSize int
	Margin         int
	Spacing        int
}

type ContactSheet struct {
	Image    image.Image
	Settings SheetSettings
	FilmType FilmType
}

func DetectFilmType(imgData []byte) FilmType {
	if len(imgData) == 0 {
		return FilmNone
	}

	// Try searching for EXIF data if it's not at the start (common for JPEGs)
	exifData, err := exif3.SearchAndExtractExif(imgData)
	if err != nil {
		// Fallback to universal search on full data if search fails
		exifData = imgData
	}

	exifTags, _, err := exif3.GetFlatExifDataUniversalSearch(exifData, nil, true)
	if err != nil {
		return FilmNone
	}

	tagsToSearch := map[string]bool{
		"FilmStock":         true,
		"Film Stock":        true,
		"-XMP-AnalogueData": true,
		"ImageDescription":  true,
		"UserComment":       true,
		"Make":              true,
		"Model":             true,
		"Software":          true,
		"Artist":            true,
		"Description":       true,
	}

	for _, tag := range exifTags {
		if tagsToSearch[tag.TagName] {
			filmType := matchFilmType(tag.Formatted)
			if filmType != FilmNone {
				fmt.Printf("[contact-sheet] detected film type %q from tag %q\n", filmType, tag.TagName)
				return filmType
			}
		}
	}

	return FilmNone
}

func matchFilmType(text string) FilmType {
	upperText := strings.ToUpper(text)

	for _, entry := range filmKeywords {
		if strings.Contains(upperText, entry.keyword) {
			return entry.filmType
		}
	}

	return FilmNone
}

func CreateFilmBorder(width, height int, filmType FilmType, isLandscape bool, pos BorderPosition) image.Image {
	borderImg := image.NewRGBA(image.Rect(0, 0, width, height))

	bgColor := color.RGBA{20, 20, 20, 255}
	perfColor := color.RGBA{35, 35, 35, 255}

	if def, ok := FilmDefinitions[filmType]; ok {
		bgColor = def.BorderColor
		perfColor = def.PerfColor
	}

	// Always fill background
	draw.Draw(borderImg, borderImg.Bounds(), &image.Uniform{bgColor}, image.Point{}, draw.Src)

	// In middle frames, we might want to "clip" the sides to make it continuous
	// but the user's request "middle columns should only have top and bottom"
	// suggests they want to avoid the extra side padding.
	// For now, let's keep the fill but only draw decorations on the ends.

	filmPerfs := createFilmPerforations(width, height, isLandscape, perfColor)
	draw.Draw(borderImg, filmPerfs.Bounds(), filmPerfs, image.Point{}, draw.Over)

	// Draw hatch marks - draw across entire width to line up when cells touch
	if isLandscape {
		startX := 0
		endX := width
		// For the start/end of the whole strip, we can indent the markers slightly if desired,
		// but drawing them fully ensures they meet perfectly between frames.
		for x := startX; x < endX; x += 40 {
			draw.Draw(borderImg, image.Rect(x, 5, x+2, height-5), &image.Uniform{color.RGBA{60, 60, 60, 255}}, image.Point{}, draw.Src)
		}

		// Draw film info
		if def, ok := FilmDefinitions[filmType]; ok {
			textColor := color.RGBA{180, 150, 50, 200}
			if def.Category == FilmCategoryBW {
				textColor = color.RGBA{200, 200, 200, 180}
			}

			// Only draw name/codes at specific positions to avoid cluttering every frame
			if pos == BorderPositionStart || pos == BorderPositionSingle {
				drawText(borderImg, 20, 20, def.Name, textColor)
				if len(def.EdgeprintCodes) > 0 {
					drawText(borderImg, 20, height-15, def.EdgeprintCodes[0], textColor)
				}
			}
			if pos == BorderPositionEnd || pos == BorderPositionSingle {
				if len(def.LetterCodes) > 0 {
					drawText(borderImg, width-80, height-15, def.LetterCodes[0], textColor)
				}
			}
		}
	} else {
		startY := 0
		endY := height
		for y := startY; y < endY; y += 40 {
			draw.Draw(borderImg, image.Rect(5, y, width-5, y+2), &image.Uniform{color.RGBA{60, 60, 60, 255}}, image.Point{}, draw.Src)
		}

		if def, ok := FilmDefinitions[filmType]; ok {
			textColor := color.RGBA{180, 150, 50, 200}
			if def.Category == FilmCategoryBW {
				textColor = color.RGBA{200, 200, 200, 180}
			}
			if pos == BorderPositionStart || pos == BorderPositionSingle {
				drawText(borderImg, 10, 50, def.Name, textColor)
				if len(def.EdgeprintCodes) > 0 {
					drawText(borderImg, 10, height-80, def.EdgeprintCodes[0], textColor)
				}
			}
		}
	}

	return borderImg
}

func drawText(dst *image.RGBA, x, y int, text string, c color.Color) {
	d := &font.Drawer{
		Dst:  dst,
		Src:  image.NewUniform(c),
		Face: basicfont.Face7x13,
		Dot:  fixed.P(x, y),
	}
	d.DrawString(text)
}

func createFilmPerforations(width, height int, isLandscape bool, perfColor color.RGBA) image.Image {
	if isLandscape {
		perfW, perfH := 8, 20
		perfCount := height / 30
		startY := (height - perfCount*30) / 2

		perfImg := image.NewRGBA(image.Rect(0, 0, width, height))

		for i := 0; i < perfCount; i++ {
			y := startY + i*30
			draw.Draw(perfImg, image.Rect(5, y, 5+perfW, y+perfH), &image.Uniform{perfColor}, image.Point{}, draw.Src)
			draw.Draw(perfImg, image.Rect(width-5-perfW, y, width-5, y+perfH), &image.Uniform{perfColor}, image.Point{}, draw.Src)
		}
		return perfImg
	} else {
		perfW, perfH := 20, 8
		perfCount := width / 30
		startX := (width - perfCount*30) / 2

		perfImg := image.NewRGBA(image.Rect(0, 0, width, height))

		for i := 0; i < perfCount; i++ {
			x := startX + i*30
			draw.Draw(perfImg, image.Rect(x, 5, x+perfW, 5+perfH), &image.Uniform{perfColor}, image.Point{}, draw.Src)
			draw.Draw(perfImg, image.Rect(x, height-5-perfH, x+perfW, height-5), &image.Uniform{perfColor}, image.Point{}, draw.Src)
		}
		return perfImg
	}
}

func ProcessImage(imgData []byte, targetWidth, targetHeight int, orientation Orientation) (image.Image, error) {
	img, _, err := image.Decode(bytes.NewReader(imgData))
	if err != nil {
		return nil, errors.New("failed to decode image")
	}

	bounds := img.Bounds()
	imgW := bounds.Dx()
	imgH := bounds.Dy()

	aspectRatio := float64(imgW) / float64(imgH)
	var cropW, cropH int

	if orientation == OrientationLandscape {
		if aspectRatio > 1.0 {
			cropH = imgH
			cropW = int(float64(cropH) * 1.5)
			if cropW > imgW {
				cropW = imgW
				cropH = int(float64(cropW) / 1.5)
			}
		} else {
			cropW = imgW
			cropH = int(float64(cropW) / 1.5)
		}
	} else {
		if aspectRatio < 1.0 {
			cropW = imgW
			cropH = int(float64(cropW) / 1.5)
			if cropH > imgH {
				cropH = imgH
				cropW = int(float64(cropH) * 1.5)
			}
		} else {
			cropH = imgH
			cropW = int(float64(cropH) * 1.5)
		}
	}

	startX := (imgW - cropW) / 2
	startY := (imgH - cropH) / 2
	cropRect := image.Rectangle{
		Min: image.Point{X: startX, Y: startY},
		Max: image.Point{X: startX + cropW, Y: startY + cropH},
	}

	type subImager interface {
		SubImage(r image.Rectangle) image.Image
	}

	var cropped image.Image
	if si, ok := img.(subImager); ok {
		cropped = si.SubImage(cropRect)
	} else {
		// Fallback: draw into a new image, but only at the crop size
		tmp := image.NewRGBA(image.Rect(0, 0, cropW, cropH))
		draw.Draw(tmp, tmp.Bounds(), img, cropRect.Min, draw.Src)
		cropped = tmp
	}

	resized := transform.Resize(cropped, targetWidth, targetHeight, transform.Linear)

	return resized, nil
}

type ProgressCallback func(current, total int)

func CreateContactSheet(images [][]byte, settings SheetSettings, onProgress ...ProgressCallback) ([]byte, error) {
	start := time.Now()
	progressCb := func(current, total int) {}
	if len(onProgress) > 0 && onProgress[0] != nil {
		progressCb = onProgress[0]
	}

	if len(images) == 0 {
		return nil, errors.New("no images provided")
	}

	if settings.Rows <= 0 {
		settings.Rows = 8
	}
	if settings.Cols <= 0 {
		settings.Cols = 10
	}
	if settings.ImageWidth <= 0 {
		settings.ImageWidth = 300
	}
	if settings.ImageHeight <= 0 {
		settings.ImageHeight = 200
	}
	if settings.Margin <= 0 {
		settings.Margin = 40
	}
	if settings.Spacing <= 0 {
		settings.Spacing = 20
	}
	if settings.FilmBorderSize <= 0 {
		settings.FilmBorderSize = 30
	}

	totalCells := settings.Rows * settings.Cols
	if len(images) > totalCells {
		images = images[:totalCells]
	}

	isLandscape := settings.Orientation == OrientationLandscape

	imgWidth := settings.ImageWidth
	imgHeight := settings.ImageHeight
	if settings.FilmStrip && settings.FilmType != FilmNone {
		if isLandscape {
			imgHeight += settings.FilmBorderSize * 2
		} else {
			imgWidth += settings.FilmBorderSize * 2
		}
	}

	// Spacing logic: zero out internal strip spacing
	colSpacing := settings.Spacing
	rowSpacing := settings.Spacing
	if settings.FilmStrip && settings.FilmType != FilmNone {
		if isLandscape {
			colSpacing = 0
		} else {
			rowSpacing = 0
		}
	}

	gridWidth := settings.Cols*imgWidth + (settings.Cols-1)*colSpacing
	if settings.FilmStrip && settings.FilmType != FilmNone && isLandscape {
		gridWidth = settings.Cols*(imgWidth+settings.FilmBorderSize) + settings.FilmBorderSize
	}

	gridHeight := settings.Rows*imgHeight + (settings.Rows-1)*rowSpacing
	if settings.FilmStrip && settings.FilmType != FilmNone && !isLandscape {
		gridHeight = settings.Rows*(imgHeight+settings.FilmBorderSize) + settings.FilmBorderSize
	}

	headerHeight := 0
	if settings.HeaderText != "" {
		headerHeight = 60
	}
	footerHeight := 0
	if settings.FooterText != "" {
		footerHeight = 60
	}

	sheetWidth := gridWidth + settings.Margin*2
	sheetHeight := gridHeight + settings.Margin*2 + headerHeight + footerHeight

	if settings.SheetWidth > 0 {
		sheetWidth = settings.SheetWidth
	}
	if settings.SheetHeight > 0 {
		sheetHeight = settings.SheetHeight
	}

	sheet := image.NewRGBA(image.Rect(0, 0, sheetWidth, sheetHeight))
	draw.Draw(sheet, sheet.Bounds(), &image.Uniform{color.RGBA{20, 20, 20, 255}}, image.Point{}, draw.Src)

	processedImages := make([]image.Image, 0, len(images))
	totalSteps := len(images) + settings.Rows*settings.Cols
	currentStep := 0
	failedImages := 0

	for i, imgData := range images {
		processed, err := ProcessImage(imgData, settings.ImageWidth, settings.ImageHeight, settings.Orientation)
		if err != nil {
			failedImages++
			fmt.Printf("[contact-sheet] image %d failed to process: %v\n", i, err)
			currentStep++
			progressCb(currentStep, totalSteps)
			continue
		}
		processedImages = append(processedImages, processed)
		currentStep++
		progressCb(currentStep, totalSteps)
	}

	if len(processedImages) == 0 {
		return nil, errors.New("no images could be decoded; verify image format and metadata")
	}

	composeStart := time.Now()
	for row := 0; row < settings.Rows; row++ {
		for col := 0; col < settings.Cols; col++ {
			idx := row*settings.Cols + col
			if idx >= len(processedImages) || processedImages[idx] == nil {
				continue
			}

			cellX := settings.Margin + col*(imgWidth+colSpacing)
			if settings.FilmStrip && settings.FilmType != FilmNone && isLandscape {
				if col > 0 {
					cellX += settings.FilmBorderSize
				}
			}

			cellY := headerHeight + settings.Margin + row*(imgHeight+rowSpacing)
			if settings.FilmStrip && settings.FilmType != FilmNone && !isLandscape {
				if row > 0 {
					cellY += settings.FilmBorderSize
				}
			}

			img := processedImages[idx]

			if settings.FilmStrip && settings.FilmType != FilmNone {
				pos := BorderPositionMiddle
				if isLandscape {
					if settings.Cols == 1 {
						pos = BorderPositionSingle
					} else if col == 0 {
						pos = BorderPositionStart
					} else if col == settings.Cols-1 {
						pos = BorderPositionEnd
					}
				} else {
					if settings.Rows == 1 {
						pos = BorderPositionSingle
					} else if row == 0 {
						pos = BorderPositionStart
					} else if row == settings.Rows-1 {
						pos = BorderPositionEnd
					}
				}

				// The very last image in the collection always gets an end-cap
				if idx == len(processedImages)-1 {
					if pos == BorderPositionStart || pos == BorderPositionSingle {
						pos = BorderPositionSingle
					} else {
						pos = BorderPositionEnd
					}
				}

				// Calculate cell dimensions for this specific frame
				// Every frame gets its own "leading" film border gap on the left (landscape) or top (portrait).
				// The VERY last frame also gets an "ending" film border cap on the right/bottom.
				cellW := imgWidth
				cellH := imgHeight
				if isLandscape {
					cellW += settings.FilmBorderSize
					if pos == BorderPositionEnd || pos == BorderPositionSingle {
						cellW += settings.FilmBorderSize
					}
				} else {
					cellH += settings.FilmBorderSize
					if pos == BorderPositionEnd || pos == BorderPositionSingle {
						cellH += settings.FilmBorderSize
					}
				}

				imgWithBorder := image.NewRGBA(image.Rect(0, 0, cellW, cellH))
				border := CreateFilmBorder(cellW, cellH, settings.FilmType, isLandscape, pos)
				draw.Draw(imgWithBorder, imgWithBorder.Bounds(), border, image.Point{}, draw.Over)

				imgX := 0
				imgY := 0
				if isLandscape {
					imgY = settings.FilmBorderSize
					imgX = settings.FilmBorderSize // Every frame is indented by its leading border
				} else {
					imgX = settings.FilmBorderSize
					imgY = settings.FilmBorderSize
				}
				draw.Draw(imgWithBorder, image.Rect(imgX, imgY, imgX+settings.ImageWidth, imgY+settings.ImageHeight), img, image.Point{}, draw.Src)
				img = imgWithBorder
			}

			draw.Draw(sheet, image.Rect(cellX, cellY, cellX+img.Bounds().Dx(), cellY+img.Bounds().Dy()), img, image.Point{}, draw.Over)
			currentStep++
			progressCb(currentStep, totalSteps)
		}
	}
	fmt.Printf("[contact-sheet] processed=%d failed=%d process_ms=%d compose_ms=%d\n",
		len(processedImages), failedImages, composeStart.Sub(start).Milliseconds(), time.Since(composeStart).Milliseconds())

	var buf bytes.Buffer
	err := jpeg.Encode(&buf, sheet, &jpeg.Options{Quality: 90})
	if err != nil {
		return nil, errors.New("failed to encode output image")
	}

	return buf.Bytes(), nil
}

func ImageToBase64(imgData []byte) string {
	return base64.StdEncoding.EncodeToString(imgData)
}

func Base64ToImage(b64 string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(b64)
}

func EstimateGrid(totalImages int) (rows, cols int) {
	cols = int(math.Ceil(math.Sqrt(float64(totalImages) * 1.5)))
	rows = (totalImages + cols - 1) / cols
	if rows < 4 {
		rows = 4
	}
	if cols < 4 {
		cols = 4
	}
	return rows, cols
}

func GetFilmDefinition(filmType FilmType) (FilmDefinition, bool) {
	def, ok := FilmDefinitions[filmType]
	return def, ok
}

func GetEdgeprintCodes(filmType FilmType) []string {
	if def, ok := FilmDefinitions[filmType]; ok {
		return def.EdgeprintCodes
	}
	return nil
}

func GetLetterCodes(filmType FilmType) []string {
	if def, ok := FilmDefinitions[filmType]; ok {
		return def.LetterCodes
	}
	return nil
}

func GetFilmCategory(filmType FilmType) FilmCategory {
	if def, ok := FilmDefinitions[filmType]; ok {
		return def.Category
	}
	return FilmCategoryNone
}

func GetAllFilmTypes() []FilmType {
	types := make([]FilmType, 0, len(FilmDefinitions))
	for ft := range FilmDefinitions {
		types = append(types, ft)
	}
	return types
}

func GetFilmTypesByCategory(category FilmCategory) []FilmType {
	var types []FilmType
	for ft, def := range FilmDefinitions {
		if def.Category == category {
			types = append(types, ft)
		}
	}
	return types
}
