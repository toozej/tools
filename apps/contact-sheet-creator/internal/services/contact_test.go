package services

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
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
