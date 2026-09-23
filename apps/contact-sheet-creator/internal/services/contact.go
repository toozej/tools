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
	return types
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
		if containsFilmKeyword(upperText, entry.keyword) {
			return entry.filmType
		}
	}

	return FilmNone
}

func containsFilmKeyword(text, keyword string) bool {
	for offset := 0; offset < len(text); {
		index := strings.Index(text[offset:], keyword)
		if index < 0 {
			return false
		}
		start := offset + index
		end := start + len(keyword)
		startsAtWord := start == 0 || !isFilmWordCharacter(text[start-1])
		endsAtWord := end == len(text) || !isFilmWordCharacter(text[end])
		if startsAtWord && endsAtWord {
			return true
		}
		offset = start + 1
	}
	return false
}

func isFilmWordCharacter(char byte) bool {
	return char >= 'A' && char <= 'Z' || char >= '0' && char <= '9'
}

func CreateFilmBorder(width, height int, filmType FilmType, isLandscape bool, pos BorderPosition) image.Image {
	borderImg := image.NewRGBA(image.Rect(0, 0, width, height))

	bgColor := color.RGBA{20, 20, 20, 255}
	perfColor := color.RGBA{35, 35, 35, 255}

	if def, ok := FilmDefinitions[filmType]; ok {
		bgColor = def.BorderColor
		perfColor = def.PerfColor
	}

	draw.Draw(borderImg, borderImg.Bounds(), &image.Uniform{bgColor}, image.Point{}, draw.Src)
	filmPerfs := createFilmPerforations(width, height, isLandscape, perfColor)
	draw.Draw(borderImg, filmPerfs.Bounds(), filmPerfs, image.Point{}, draw.Over)
	if def, ok := FilmDefinitions[filmType]; ok {
		textColor := color.RGBA{220, 190, 100, 255}
		if def.Category == FilmCategoryBW {
			textColor = color.RGBA{225, 225, 225, 255}
		}
		if isLandscape {
			if pos == BorderPositionStart || pos == BorderPositionSingle {
				drawFilmLabel(borderImg, 18, 22, def.Name, textColor, bgColor)
			}
			if (pos == BorderPositionEnd || pos == BorderPositionSingle) && len(def.LetterCodes) > 0 {
				drawFilmLabel(borderImg, 18, height-10, def.LetterCodes[0], textColor, bgColor)
			}
		} else {
			if pos == BorderPositionStart || pos == BorderPositionSingle {
				drawFilmLabel(borderImg, 10, 22, def.Name, textColor, bgColor)
			}
			if (pos == BorderPositionEnd || pos == BorderPositionSingle) && len(def.LetterCodes) > 0 {
				drawFilmLabel(borderImg, 10, height-10, def.LetterCodes[0], textColor, bgColor)
			}
		}
	}

	return borderImg
}

func drawFilmLabel(dst *image.RGBA, x, y int, label string, textColor, bgColor color.RGBA) {
	maxChars := (dst.Bounds().Dx() - x - 8) / 7
	if maxChars <= 0 {
		return
	}
	if len(label) > maxChars {
		label = label[:maxChars]
	}
	draw.Draw(dst, image.Rect(x-3, y-12, x+len(label)*7+3, y+3), image.NewUniform(bgColor), image.Point{}, draw.Src)
	drawText(dst, x, y, label, textColor)
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
	perfImg := image.NewRGBA(image.Rect(0, 0, width, height))
	holeColor := color.RGBA{165, 165, 155, 255}
	drawHole := func(rect image.Rectangle) {
		draw.Draw(perfImg, rect, image.NewUniform(holeColor), image.Point{}, draw.Src)
		inner := rect.Inset(2)
		draw.Draw(perfImg, inner, image.NewUniform(perfColor), image.Point{}, draw.Src)
	}
	if isLandscape {
		perfW, perfH := 15, 8
		perfCount := width / 30
		startX := (width - perfCount*30) / 2
		for i := 0; i < perfCount; i++ {
			x := startX + i*30
			drawHole(image.Rect(x, 4, x+perfW, 4+perfH))
			drawHole(image.Rect(x, height-4-perfH, x+perfW, height-4))
		}
	} else {
		perfW, perfH := 8, 15
		perfCount := height / 30
		startY := (height - perfCount*30) / 2
		for i := 0; i < perfCount; i++ {
			y := startY + i*30
			drawHole(image.Rect(4, y, 4+perfW, y+perfH))
			drawHole(image.Rect(width-4-perfW, y, width-4, y+perfH))
		}
	}
	return perfImg
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
	type frame struct {
		image image.Image
		film  FilmType
	}
	frames := make([]frame, 0, len(images))
	totalSteps := len(images) + totalCells
	currentStep := 0
	failedImages := 0
	hasBorder := false
	for i, imgData := range images {
		processed, err := ProcessImage(imgData, settings.ImageWidth, settings.ImageHeight, settings.Orientation)
		currentStep++
		progressCb(currentStep, totalSteps)
		if err != nil {
			failedImages++
			fmt.Printf("[contact-sheet] image %d failed to process: %v\n", i, err)
			continue
		}
		filmType := FilmNone
		if settings.FilmStrip {
			if settings.FilmType != FilmNone {
				if _, ok := FilmDefinitions[settings.FilmType]; ok {
					filmType = settings.FilmType
				}
			} else {
				filmType = DetectFilmType(imgData)
			}
		}
		if filmType != FilmNone {
			hasBorder = true
		}
		frames = append(frames, frame{image: processed, film: filmType})
	}
	if len(frames) == 0 {
		return nil, errors.New("no images could be decoded; verify image format and metadata")
	}

	borderSize := 0
	if hasBorder {
		borderSize = settings.FilmBorderSize
	}
	cellWidth := settings.ImageWidth + borderSize*2
	cellHeight := settings.ImageHeight + borderSize*2
	gridWidth := settings.Cols*cellWidth + (settings.Cols-1)*settings.Spacing
	gridHeight := settings.Rows*cellHeight + (settings.Rows-1)*settings.Spacing
	headerHeight := 0
	if settings.HeaderText != "" {
		headerHeight = 40
	}
	footerHeight := 0
	if settings.FooterText != "" {
		footerHeight = 40
	}
	naturalWidth := gridWidth + settings.Margin*2
	naturalHeight := gridHeight + settings.Margin*2 + headerHeight + footerHeight
	sheet := image.NewRGBA(image.Rect(0, 0, naturalWidth, naturalHeight))
	background := color.RGBA{20, 20, 20, 255}
	draw.Draw(sheet, sheet.Bounds(), image.NewUniform(background), image.Point{}, draw.Src)
	textColor := color.RGBA{235, 235, 235, 255}
	if headerHeight > 0 {
		drawSheetText(sheet, settings.HeaderText, settings.Margin, settings.Margin+24, naturalWidth-settings.Margin*2, textColor)
	}
	if footerHeight > 0 {
		drawSheetText(sheet, settings.FooterText, settings.Margin, naturalHeight-settings.Margin-10, naturalWidth-settings.Margin*2, textColor)
	}

	composeStart := time.Now()
	for idx, frame := range frames {
		row := idx / settings.Cols
		col := idx % settings.Cols
		cellX := settings.Margin + col*(cellWidth+settings.Spacing)
		cellY := settings.Margin + headerHeight + row*(cellHeight+settings.Spacing)
		if frame.film != FilmNone {
			border := CreateFilmBorder(cellWidth, cellHeight, frame.film, settings.Orientation == OrientationLandscape, BorderPositionSingle)
			draw.Draw(sheet, image.Rect(cellX, cellY, cellX+cellWidth, cellY+cellHeight), border, image.Point{}, draw.Src)
		}
		imageX := cellX + borderSize
		imageY := cellY + borderSize
		draw.Draw(sheet, image.Rect(imageX, imageY, imageX+settings.ImageWidth, imageY+settings.ImageHeight), frame.image, image.Point{}, draw.Src)
	}
	for currentStep < totalSteps {
		currentStep++
		progressCb(currentStep, totalSteps)
	}

	outputWidth := naturalWidth
	outputHeight := naturalHeight
	if settings.SheetWidth > 0 {
		outputWidth = settings.SheetWidth
	}
	if settings.SheetHeight > 0 {
		outputHeight = settings.SheetHeight
	}
	if outputWidth != naturalWidth || outputHeight != naturalHeight {
		scale := math.Min(1, math.Min(float64(outputWidth)/float64(naturalWidth), float64(outputHeight)/float64(naturalHeight)))
		scaledWidth := int(math.Round(float64(naturalWidth) * scale))
		scaledHeight := int(math.Round(float64(naturalHeight) * scale))
		if scaledWidth < 1 {
			scaledWidth = 1
		}
		if scaledHeight < 1 {
			scaledHeight = 1
		}
		var content image.Image = sheet
		if scale < 1 {
			content = transform.Resize(sheet, scaledWidth, scaledHeight, transform.Linear)
		}
		output := image.NewRGBA(image.Rect(0, 0, outputWidth, outputHeight))
		draw.Draw(output, output.Bounds(), image.NewUniform(background), image.Point{}, draw.Src)
		offset := image.Pt((outputWidth-scaledWidth)/2, (outputHeight-scaledHeight)/2)
		draw.Draw(output, image.Rectangle{Min: offset, Max: offset.Add(image.Pt(scaledWidth, scaledHeight))}, content, image.Point{}, draw.Src)
		sheet = output
	}

	fmt.Printf("[contact-sheet] processed=%d failed=%d process_ms=%d compose_ms=%d\n",
		len(frames), failedImages, composeStart.Sub(start).Milliseconds(), time.Since(composeStart).Milliseconds())
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, sheet, &jpeg.Options{Quality: 90}); err != nil {
		return nil, errors.New("failed to encode output image")
	}
	return buf.Bytes(), nil
}

func drawSheetText(dst *image.RGBA, label string, x, y, maxWidth int, textColor color.Color) {
	if label == "" || maxWidth < 1 {
		return
	}
	textWidth := font.MeasureString(basicfont.Face7x13, label).Ceil()
	if textWidth < 1 {
		return
	}
	textImage := image.NewRGBA(image.Rect(0, 0, textWidth, 15))
	drawText(textImage, 0, 13, label, textColor)
	targetWidth := textWidth * 2
	if targetWidth > maxWidth {
		targetWidth = maxWidth
	}
	targetHeight := int(math.Round(15 * float64(targetWidth) / float64(textWidth)))
	if targetHeight < 1 {
		targetHeight = 1
	}
	scaledText := transform.Resize(textImage, targetWidth, targetHeight, transform.NearestNeighbor)
	draw.Draw(dst, image.Rect(x, y-targetHeight, x+targetWidth, y), scaledText, image.Point{}, draw.Over)
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
