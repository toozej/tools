package services

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/image/tiff"
)

func createTestTiff(t *testing.T, width, height int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{R: 255, G: 0, B: 0, A: 255})
		}
	}
	var buf bytes.Buffer
	err := tiff.Encode(&buf, img, nil)
	if err != nil {
		t.Fatalf("failed to encode test tiff: %v", err)
	}
	return buf.Bytes()
}

func createTestImage(t *testing.T, width, height int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 255})
		}
	}
	var buf bytes.Buffer
	encoder := png.Encoder{CompressionLevel: png.BestCompression}
	err := encoder.Encode(&buf, img)
	if err != nil {
		t.Fatalf("failed to encode test image: %v", err)
	}
	return buf.Bytes()
}

func createTestJPEGWithFilm(t *testing.T, film string) []byte {
	t.Helper()
	var jpegData bytes.Buffer
	img := image.NewRGBA(image.Rect(0, 0, 60, 40))
	draw.Draw(img, img.Bounds(), image.NewUniform(color.RGBA{200, 80, 40, 255}), image.Point{}, draw.Src)
	if err := jpeg.Encode(&jpegData, img, nil); err != nil {
		t.Fatal(err)
	}
	label := append([]byte(film), 0)
	tiffData := make([]byte, 26+len(label))
	copy(tiffData, "II")
	binary.LittleEndian.PutUint16(tiffData[2:], 42)
	binary.LittleEndian.PutUint32(tiffData[4:], 8)
	binary.LittleEndian.PutUint16(tiffData[8:], 1)
	binary.LittleEndian.PutUint16(tiffData[10:], 0x010e)
	binary.LittleEndian.PutUint16(tiffData[12:], 2)
	binary.LittleEndian.PutUint32(tiffData[14:], uint32(len(label)))
	binary.LittleEndian.PutUint32(tiffData[18:], 26)
	copy(tiffData[26:], label)
	segment := append([]byte("Exif\x00\x00"), tiffData...)
	result := append([]byte{}, jpegData.Bytes()[:2]...)
	result = append(result, 0xff, 0xe1, byte((len(segment)+2)>>8), byte(len(segment)+2))
	result = append(result, segment...)
	return append(result, jpegData.Bytes()[2:]...)
}

func TestMatchFilmType(t *testing.T) {
	tests := []struct {
		input    string
		expected FilmType
	}{
		{"T-MAX 400", "TMAX 400"},
		{"TMAX 400", "TMAX 400"},
		{"TMX 400", "TMAX 400"},
		{"Tri-X 400", "Tri-X 400"},
		{"TRIX 400", "Tri-X 400"},
		{"HP5 PLUS 400", "HP5 PLUS"},
		{"HP5+ 400", "HP5 PLUS"},
		{"FP4 PLUS 125", "FP4 PLUS 125"},
		{"FP4+ 125", "FP4 PLUS 125"},
		{"PAN F PLUS 50", "Pan F Plus 50"},
		{"PANF+ 50", "Pan F Plus 50"},
		{"ORTHO PLUS 80", "ORTHO PLUS 80"},
		{"ORTHO+ 80", "ORTHO PLUS 80"},
		{"XP2 SUPER 400", "XP2 SUPER 400"},
		{"XP2 SUPER", "XP2 SUPER 400"},
		{"KENTMERE 100", "KENTMERE 100"},
		{"KENTMERE 400", "KENTMERE 400"},
		{"SFX 200", "SFX 200"},
		{"Unknown Film", FilmNone},
		{"MINOLTA MAXXUM 7000", FilmNone},
		{"", FilmNone},
		{"random text", FilmNone},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := matchFilmType(tt.input)
			if result != tt.expected {
				t.Errorf("matchFilmType(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestDetectFilmType(t *testing.T) {
	tests := []struct {
		name     string
		exifData []byte
		expected FilmType
	}{
		{
			name:     "empty data",
			exifData: []byte{},
			expected: FilmNone,
		},
		{
			name:     "nil data",
			exifData: nil,
			expected: FilmNone,
		},
		{
			name:     "invalid exif data",
			exifData: []byte("not exif data"),
			expected: FilmNone,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := DetectFilmType(tt.exifData)
			if result != tt.expected {
				t.Errorf("DetectFilmType() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestDetectFilmTypeFromJPEGEXIF(t *testing.T) {
	tests := []struct {
		label string
		want  FilmType
	}{
		{"KODAK T-MAX 400", "TMAX 400"},
		{"ILFORD HP5 PLUS", "HP5 PLUS"},
		{"Unknown stock", FilmNone},
	}
	for _, tt := range tests {
		t.Run(tt.label, func(t *testing.T) {
			if got := DetectFilmType(createTestJPEGWithFilm(t, tt.label)); got != tt.want {
				t.Fatalf("DetectFilmType() = %q, want %q", got, tt.want)
			}
		})
	}
}

func countBrightPixels(img image.Image, rect image.Rectangle) int {
	count := 0
	for y := rect.Min.Y; y < rect.Max.Y; y++ {
		for x := rect.Min.X; x < rect.Max.X; x++ {
			r, g, b, _ := img.At(x, y).RGBA()
			if r>>8 > 150 && g>>8 > 150 && b>>8 > 150 {
				count++
			}
		}
	}
	return count
}

func TestCreateContactSheet_AutomaticFilmAndPlainFrame(t *testing.T) {
	settings := SheetSettings{Rows: 1, Cols: 3, ImageWidth: 60, ImageHeight: 40, Margin: 10, Spacing: 5, FilmStrip: true}
	result, err := CreateContactSheet([][]byte{
		createTestJPEGWithFilm(t, "T-MAX 400"),
		createTestJPEGWithFilm(t, "ILFORD HP5 PLUS"),
		createTestJPEGWithFilm(t, "Unknown stock"),
	}, settings)
	if err != nil {
		t.Fatal(err)
	}
	img, err := jpeg.Decode(bytes.NewReader(result))
	if err != nil {
		t.Fatal(err)
	}
	if got, want := img.Bounds().Dx(), 390; got != want {
		t.Fatalf("sheet width = %d, want %d", got, want)
	}
	if got := countBrightPixels(img, image.Rect(25, 14, 112, 36)); got < 10 {
		t.Fatalf("first frame has no visible film label: %d bright pixels", got)
	}
	if got := countBrightPixels(img, image.Rect(150, 14, 237, 36)); got < 10 {
		t.Fatalf("second frame has no visible film label: %d bright pixels", got)
	}
	if got := countBrightPixels(img, image.Rect(275, 14, 362, 36)); got != 0 {
		t.Fatalf("unmatched frame has a film label: %d bright pixels", got)
	}
}

func TestCreateContactSheet_CustomDimensionsAndText(t *testing.T) {
	settings := SheetSettings{
		Rows: 1, Cols: 1, ImageWidth: 60, ImageHeight: 40,
		Margin: 10, SheetWidth: 90, SheetHeight: 100,
		HeaderText: "HEADER", FooterText: "FOOTER",
	}
	result, err := CreateContactSheet([][]byte{createTestImage(t, 60, 40)}, settings)
	if err != nil {
		t.Fatal(err)
	}
	img, err := jpeg.Decode(bytes.NewReader(result))
	if err != nil {
		t.Fatal(err)
	}
	if got := img.Bounds().Size(); got != (image.Point{X: 90, Y: 100}) {
		t.Fatalf("sheet size = %v, want 90x100", got)
	}
	if got := countBrightPixels(img, image.Rect(0, 0, 90, 35)); got < 10 {
		t.Fatalf("header is not visible: %d bright pixels", got)
	}
	if got := countBrightPixels(img, image.Rect(0, 65, 90, 100)); got < 10 {
		t.Fatalf("footer is not visible: %d bright pixels", got)
	}
}

func TestCreateContactSheet_ManualAndDisabledBorders(t *testing.T) {
	tests := []struct {
		name      string
		filmStrip bool
		filmType  FilmType
		wantWidth int
	}{
		{"manual film", true, "HP5 PLUS", 140},
		{"border disabled", false, "HP5 PLUS", 80},
		{"automatic without EXIF", true, FilmNone, 80},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			settings := SheetSettings{
				Rows: 1, Cols: 1, ImageWidth: 60, ImageHeight: 40,
				Margin: 10, FilmStrip: tt.filmStrip, FilmType: tt.filmType,
			}
			result, err := CreateContactSheet([][]byte{createTestImage(t, 60, 40)}, settings)
			if err != nil {
				t.Fatal(err)
			}
			img, err := jpeg.Decode(bytes.NewReader(result))
			if err != nil {
				t.Fatal(err)
			}
			if got := img.Bounds().Dx(); got != tt.wantWidth {
				t.Fatalf("sheet width = %d, want %d", got, tt.wantWidth)
			}
		})
	}
}

func TestEstimateGrid(t *testing.T) {
	tests := []struct {
		inputImages int
	}{
		{1},
		{10},
		{16},
		{20},
		{24},
		{36},
		{50},
		{100},
	}

	for _, tt := range tests {
		t.Run("", func(t *testing.T) {
			rows, cols := EstimateGrid(tt.inputImages)
			if rows < 4 {
				t.Errorf("EstimateGrid(%d) rows = %d, want >= 4", tt.inputImages, rows)
			}
			if cols < 4 {
				t.Errorf("EstimateGrid(%d) cols = %d, want >= 4", tt.inputImages, cols)
			}
			totalCells := rows * cols
			if totalCells < tt.inputImages {
				t.Errorf("EstimateGrid(%d) total cells %d < input %d", tt.inputImages, totalCells, tt.inputImages)
			}
		})
	}
}

func TestImageToBase64(t *testing.T) {
	data := []byte("hello world")
	result := ImageToBase64(data)
	expected := base64.StdEncoding.EncodeToString(data)
	if result != expected {
		t.Errorf("ImageToBase64() = %v, want %v", result, expected)
	}
}

func TestBase64ToImage(t *testing.T) {
	original := []byte("hello world")
	encoded := base64.StdEncoding.EncodeToString(original)
	result, err := Base64ToImage(encoded)
	if err != nil {
		t.Errorf("Base64ToImage() error = %v", err)
	}
	if string(result) != string(original) {
		t.Errorf("Base64ToImage() = %v, want %v", result, original)
	}
}

func TestBase64ToImage_Invalid(t *testing.T) {
	_, err := Base64ToImage("not-valid-base64!!!")
	if err == nil {
		t.Error("Base64ToImage() expected error for invalid input")
	}
}

func TestCreateFilmBorder(t *testing.T) {
	tests := []struct {
		name        string
		width       int
		height      int
		filmType    FilmType
		isLandscape bool
		pos         BorderPosition
	}{
		{"TMAX400 landscape single", 330, 260, "TMAX 400", true, BorderPositionSingle},
		{"TMAX400 landscape start", 330, 260, "TMAX 400", true, BorderPositionStart},
		{"TMAX400 landscape middle", 310, 260, "TMAX 400", true, BorderPositionMiddle},
		{"TMAX400 landscape end", 330, 260, "TMAX 400", true, BorderPositionEnd},
		{"HP5 Plus portrait", 260, 330, "HP5 PLUS", false, BorderPositionSingle},
		{"Portra 400 landscape", 330, 260, "Portra 400", true, BorderPositionSingle},
		{"No film type", 330, 260, FilmNone, true, BorderPositionSingle},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CreateFilmBorder(tt.width, tt.height, tt.filmType, tt.isLandscape, tt.pos)
			if result.Bounds().Dx() != tt.width || result.Bounds().Dy() != tt.height {
				t.Errorf("CreateFilmBorder() size = %dx%d, want %dx%d",
					result.Bounds().Dx(), result.Bounds().Dy(), tt.width, tt.height)
			}
		})
	}
}

func TestProcessImage(t *testing.T) {
	tests := []struct {
		name         string
		imgData      []byte
		targetWidth  int
		targetHeight int
		orientation  Orientation
		expectError  bool
	}{
		{
			name:         "valid PNG landscape",
			imgData:      createTestImage(t, 800, 600),
			targetWidth:  300,
			targetHeight: 200,
			orientation:  OrientationLandscape,
			expectError:  false,
		},
		{
			name:         "valid PNG portrait",
			imgData:      createTestImage(t, 600, 800),
			targetWidth:  200,
			targetHeight: 300,
			orientation:  OrientationPortrait,
			expectError:  false,
		},
		{
			name:         "valid TIFF landscape",
			imgData:      createTestTiff(t, 800, 600),
			targetWidth:  300,
			targetHeight: 200,
			orientation:  OrientationLandscape,
			expectError:  false,
		},
		{
			name:         "invalid image data",
			imgData:      []byte("not an image"),
			targetWidth:  300,
			targetHeight: 200,
			orientation:  OrientationLandscape,
			expectError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ProcessImage(tt.imgData, tt.targetWidth, tt.targetHeight, tt.orientation)
			if tt.expectError && err == nil {
				t.Error("ProcessImage() expected error")
			}
			if !tt.expectError {
				if err != nil {
					t.Errorf("ProcessImage() unexpected error: %v", err)
				}
				if result.Bounds().Dx() != tt.targetWidth || result.Bounds().Dy() != tt.targetHeight {
					t.Errorf("ProcessImage() size = %dx%d, want %dx%d",
						result.Bounds().Dx(), result.Bounds().Dy(), tt.targetWidth, tt.targetHeight)
				}
			}
		})
	}
}

func TestCreateContactSheet(t *testing.T) {
	tests := []struct {
		name        string
		images      [][]byte
		settings    SheetSettings
		expectError bool
	}{
		{
			name:   "empty images",
			images: [][]byte{},
			settings: SheetSettings{
				Rows: 4,
				Cols: 4,
			},
			expectError: true,
		},
		{
			name:   "valid single image",
			images: [][]byte{createTestImage(t, 800, 600)},
			settings: SheetSettings{
				Rows:        4,
				Cols:        4,
				ImageWidth:  200,
				ImageHeight: 150,
				Margin:      20,
				Spacing:     10,
			},
			expectError: false,
		},
		{
			name:   "with film strip",
			images: [][]byte{createTestImage(t, 800, 600)},
			settings: SheetSettings{
				Rows:        4,
				Cols:        4,
				ImageWidth:  200,
				ImageHeight: 150,
				FilmStrip:   true,
				FilmType:    "TMAX 400",
				Margin:      20,
				Spacing:     10,
			},
			expectError: false,
		},
		{
			name:   "with header and footer text",
			images: [][]byte{createTestImage(t, 800, 600)},
			settings: SheetSettings{
				Rows:        4,
				Cols:        4,
				ImageWidth:  200,
				ImageHeight: 150,
				HeaderText:  "Test Contact Sheet",
				FooterText:  "2024",
				Margin:      20,
				Spacing:     10,
			},
			expectError: false,
		},
		{
			name: "multiple images",
			images: [][]byte{
				createTestImage(t, 800, 600),
				createTestImage(t, 800, 600),
				createTestImage(t, 800, 600),
				createTestImage(t, 800, 600),
			},
			settings: SheetSettings{
				Rows:        2,
				Cols:        2,
				ImageWidth:  200,
				ImageHeight: 150,
				Margin:      20,
				Spacing:     10,
			},
			expectError: false,
		},
		{
			name:        "default settings",
			images:      [][]byte{createTestImage(t, 800, 600)},
			settings:    SheetSettings{},
			expectError: false,
		},
		{
			name:   "custom sheet dimensions",
			images: [][]byte{createTestImage(t, 800, 600)},
			settings: SheetSettings{
				Rows:        4,
				Cols:        4,
				SheetWidth:  1200,
				SheetHeight: 800,
				Margin:      20,
				Spacing:     10,
			},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := CreateContactSheet(tt.images, tt.settings)
			if tt.expectError && err == nil {
				t.Error("CreateContactSheet() expected error")
			}
			if !tt.expectError {
				if err != nil {
					t.Errorf("CreateContactSheet() unexpected error: %v", err)
				}
				if len(result) == 0 {
					t.Error("CreateContactSheet() returned empty result")
				}
			}
		})
	}
}

func TestCreateContactSheet_TruncatesImages(t *testing.T) {
	images := make([][]byte, 20)
	for i := range images {
		images[i] = createTestImage(t, 800, 600)
	}

	settings := SheetSettings{
		Rows:        3,
		Cols:        3,
		ImageWidth:  200,
		ImageHeight: 150,
	}

	result, err := CreateContactSheet(images, settings)
	if err != nil {
		t.Errorf("CreateContactSheet() unexpected error: %v", err)
	}
	if len(result) == 0 {
		t.Error("CreateContactSheet() returned empty result")
	}
}

func TestCreateContactSheet_PortraitOrientation(t *testing.T) {
	img := createTestImage(t, 600, 800)

	settings := SheetSettings{
		Orientation: OrientationPortrait,
		Rows:        2,
		Cols:        2,
		ImageWidth:  200,
		ImageHeight: 300,
		Margin:      20,
		Spacing:     10,
	}

	result, err := CreateContactSheet([][]byte{img}, settings)
	if err != nil {
		t.Errorf("CreateContactSheet() unexpected error: %v", err)
	}
	if len(result) == 0 {
		t.Error("CreateContactSheet() returned empty result")
	}
}

func rgba8(c color.Color) color.RGBA {
	r, g, b, a := c.RGBA()
	return color.RGBA{uint8(r >> 8), uint8(g >> 8), uint8(b >> 8), uint8(a >> 8)}
}

func isNearBackground(c color.Color) bool {
	rgba := rgba8(c)
	const bg = 20
	const tolerance = 12
	dr := int(rgba.R) - bg
	dg := int(rgba.G) - bg
	db := int(rgba.B) - bg
	if dr < 0 {
		dr = -dr
	}
	if dg < 0 {
		dg = -dg
	}
	if db < 0 {
		db = -db
	}
	return dr <= tolerance && dg <= tolerance && db <= tolerance
}

func TestCreateContactSheet_CompactsAfterFailedImage(t *testing.T) {
	settings := SheetSettings{
		Rows:        1,
		Cols:        2,
		ImageWidth:  60,
		ImageHeight: 40,
		Margin:      4,
		Spacing:     2,
	}

	images := [][]byte{
		[]byte("not an image"),
		createTestImage(t, 800, 600),
	}

	result, err := CreateContactSheet(images, settings)
	if err != nil {
		t.Fatalf("CreateContactSheet() unexpected error: %v", err)
	}

	decoded, _, err := image.Decode(bytes.NewReader(result))
	if err != nil {
		t.Fatalf("failed to decode generated sheet: %v", err)
	}

	firstCellX := settings.Margin + settings.ImageWidth/2
	secondCellX := settings.Margin + (settings.ImageWidth + settings.Spacing) + settings.ImageWidth/2
	cellY := settings.Margin + settings.ImageHeight/2

	if isNearBackground(decoded.At(firstCellX, cellY)) {
		t.Fatalf("expected first cell to contain a processed image, got near-background pixel")
	}

	if !isNearBackground(decoded.At(secondCellX, cellY)) {
		t.Fatalf("expected second cell to remain empty background")
	}
}

func TestCreateContactSheet_AllInvalidImagesReturnsError(t *testing.T) {
	_, err := CreateContactSheet([][]byte{[]byte("x"), []byte("y")}, SheetSettings{Rows: 1, Cols: 2})
	if err == nil {
		t.Fatal("expected error when all images are invalid")
	}
	if !strings.Contains(err.Error(), "no images could be decoded") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestMatchFilmType_PrioritizesSpecificKeyword(t *testing.T) {
	input := "Kodak TMAX 400 MAX"
	got := matchFilmType(input)
	if got != FilmType("TMAX 400") {
		t.Fatalf("matchFilmType(%q) = %q, want %q", input, got, FilmType("TMAX 400"))
	}
}

func BenchmarkMatchFilmType(b *testing.B) {
	for i := 0; i < b.N; i++ {
		matchFilmType("T-MAX 400")
	}
}

func BenchmarkEstimateGrid(b *testing.B) {
	for i := 0; i < b.N; i++ {
		EstimateGrid(36)
	}
}

func BenchmarkCreateFilmBorder(b *testing.B) {
	for i := 0; i < b.N; i++ {
		CreateFilmBorder(330, 260, "TMAX 400", true, BorderPositionSingle)
	}
}

func BenchmarkProcessImage(b *testing.B) {
	imgData := createTestImage(&testing.T{}, 800, 600)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ProcessImage(imgData, 300, 200, OrientationLandscape)
	}
}

func BenchmarkCreateContactSheet(b *testing.B) {
	images := make([][]byte, 16)
	for i := range images {
		images[i] = createTestImage(&testing.T{}, 800, 600)
	}
	settings := SheetSettings{
		Rows:        4,
		Cols:        4,
		ImageWidth:  200,
		ImageHeight: 150,
		Margin:      20,
		Spacing:     10,
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		CreateContactSheet(images, settings)
	}
}

func TestMain(m *testing.M) {
	tmpDir := filepath.Join(os.TempDir(), "contact-sheet-tests")
	os.MkdirAll(tmpDir, 0755)
	os.Chdir(tmpDir)
	m.Run()
}
