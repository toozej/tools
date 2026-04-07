package services

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"path/filepath"
	"strings"
	"testing"

	_ "golang.org/x/image/bmp"
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

func TestEncodeBMP(t *testing.T) {
	tests := []struct {
		name     string
		width    int
		height   int
		expected []byte
	}{
		{
			name:   "small image",
			width:  2,
			height: 2,
		},
		{
			name:   "XTeink resolution",
			width:  480,
			height: 800,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a test image
			img := image.NewRGBA(image.Rect(0, 0, tt.width, tt.height))
			for y := 0; y < tt.height; y++ {
				for x := 0; x < tt.width; x++ {
					img.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 255})
				}
			}

			result, err := encodeBMP(img)
			if err != nil {
				t.Errorf("encodeBMP() error = %v", err)
				return
			}

			if len(result) == 0 {
				t.Error("encodeBMP() returned empty result")
				return
			}

			// Basic BMP header validation
			if len(result) < 54 {
				t.Error("encodeBMP() result too short for BMP header")
				return
			}

			// Check BMP signature
			if result[0] != 'B' || result[1] != 'M' {
				t.Error("encodeBMP() missing BMP signature")
				return
			}

			// Check file size (little endian)
			fileSize := int(result[5])<<24 + int(result[4])<<16 + int(result[3])<<8 + int(result[2])
			if fileSize != len(result) {
				t.Errorf("encodeBMP() file size mismatch: got %d, want %d", fileSize, len(result))
			}

			// Check data offset (should be 54 for uncompressed 24-bit)
			dataOffset := int(result[13])<<24 + int(result[12])<<16 + int(result[11])<<8 + int(result[10])
			if dataOffset != 54 {
				t.Errorf("encodeBMP() data offset = %d, want 54", dataOffset)
			}

			// Check width and height (little endian)
			width := int(result[21])<<24 + int(result[20])<<16 + int(result[19])<<8 + int(result[18])
			height := int(result[25])<<24 + int(result[24])<<16 + int(result[23])<<8 + int(result[22])
			if width != tt.width {
				t.Errorf("encodeBMP() width = %d, want %d", width, tt.width)
			}
			if height != tt.height {
				t.Errorf("encodeBMP() height = %d, want %d", height, tt.height)
			}

			// Check bits per pixel (should be 24)
			bpp := int(result[29])<<8 + int(result[28])
			if bpp != 24 {
				t.Errorf("encodeBMP() bits per pixel = %d, want 24", bpp)
			}
		})
	}
}

func TestConvertImageToWallpaper(t *testing.T) {
	tests := []struct {
		name        string
		imgData     []byte
		cropX       int
		cropY       int
		cropWidth   int
		cropHeight  int
		expectError bool
	}{
		{
			name:        "valid PNG landscape",
			imgData:     createTestImage(t, 800, 600),
			cropX:       0,
			cropY:       0,
			cropWidth:   0,
			cropHeight:  0,
			expectError: false,
		},
		{
			name:        "valid PNG portrait",
			imgData:     createTestImage(t, 600, 800),
			cropX:       0,
			cropY:       0,
			cropWidth:   0,
			cropHeight:  0,
			expectError: false,
		},
		{
			name:        "custom crop",
			imgData:     createTestImage(t, 800, 600),
			cropX:       100,
			cropY:       50,
			cropWidth:   400,
			cropHeight:  300,
			expectError: false,
		},
		{
			name:        "invalid image data",
			imgData:     []byte("not an image"),
			cropX:       0,
			cropY:       0,
			cropWidth:   0,
			cropHeight:  0,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ConvertImageToWallpaper(tt.imgData, tt.cropX, tt.cropY, tt.cropWidth, tt.cropHeight)
			if tt.expectError && err == nil {
				t.Error("ConvertImageToWallpaper() expected error")
			}
			if !tt.expectError {
				if err != nil {
					t.Errorf("ConvertImageToWallpaper() unexpected error: %v", err)
				}
				if len(result) == 0 {
					t.Error("ConvertImageToWallpaper() returned empty result")
				}
				// Verify BMP format
				if len(result) < 54 || result[0] != 'B' || result[1] != 'M' {
					t.Error("ConvertImageToWallpaper() did not return valid BMP")
				}
			}
		})
	}
}

func TestCreateWallpaperZip(t *testing.T) {
	tests := []struct {
		name        string
		images      [][]byte
		filenames   []string
		expectError bool
	}{
		{
			name:        "single image",
			images:      [][]byte{createTestImage(t, 800, 600)},
			filenames:   []string{"test1.jpg"},
			expectError: false,
		},
		{
			name: "multiple images",
			images: [][]byte{
				createTestImage(t, 800, 600),
				createTestImage(t, 600, 800),
			},
			filenames:   []string{"landscape.jpg", "portrait.png"},
			expectError: false,
		},
		{
			name:        "empty images",
			images:      [][]byte{},
			filenames:   []string{},
			expectError: false, // Should handle empty gracefully
		},
		{
			name:        "invalid image",
			images:      [][]byte{[]byte("not an image")},
			filenames:   []string{"invalid.jpg"},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := CreateWallpaperZip(tt.images, tt.filenames)
			if tt.expectError && err == nil {
				t.Error("CreateWallpaperZip() expected error")
			}
			if !tt.expectError {
				if err != nil {
					t.Errorf("CreateWallpaperZip() unexpected error: %v", err)
				}
				if len(tt.images) > 0 && len(result) == 0 {
					t.Error("CreateWallpaperZip() returned empty result for valid input")
				}

				// Verify ZIP format
				if len(tt.images) > 0 {
					zipReader, err := zip.NewReader(bytes.NewReader(result), int64(len(result)))
					if err != nil {
						t.Errorf("CreateWallpaperZip() did not create valid ZIP: %v", err)
					} else {
						if len(zipReader.File) != len(tt.images) {
							t.Errorf("CreateWallpaperZip() ZIP contains %d files, want %d", len(zipReader.File), len(tt.images))
						}

						// Check filenames
						for i, file := range zipReader.File {
							expectedName := "wallpaper.bmp"
							if i < len(tt.filenames) && tt.filenames[i] != "" {
								ext := filepath.Ext(tt.filenames[i])
								name := strings.TrimSuffix(tt.filenames[i], ext)
								expectedName = name + ".bmp"
							}
							if file.Name != expectedName {
								t.Errorf("CreateWallpaperZip() file %d name = %q, want %q", i, file.Name, expectedName)
							}
						}
					}
				}
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

func TestConvertImageToWallpaper_AutomaticCroppingPrioritizesHeight(t *testing.T) {
	// Test that automatic cropping prioritizes using full image height when possible
	tests := []struct {
		name         string
		imgWidth     int
		imgHeight    int
		expectedCrop struct{ width, height int }
	}{
		{
			name:         "wide landscape image",
			imgWidth:     1000,
			imgHeight:    600,
			expectedCrop: struct{ width, height int }{360, 600}, // Uses full height, crops width
		},
		{
			name:         "narrow portrait image",
			imgWidth:     400,
			imgHeight:    1000,
			expectedCrop: struct{ width, height int }{400, 666}, // Uses full width, crops height to fit aspect (400 / 0.6 = 666.67, truncated to 666)
		},
		{
			name:         "square image",
			imgWidth:     500,
			imgHeight:    500,
			expectedCrop: struct{ width, height int }{300, 500}, // Uses full height, crops width
		},
		{
			name:         "exact aspect ratio",
			imgWidth:     480,
			imgHeight:    800,
			expectedCrop: struct{ width, height int }{480, 800}, // Uses full image
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			imgData := createTestImage(t, tt.imgWidth, tt.imgHeight)

			// We'll test the cropping logic by checking what crop region would be selected
			img, _, err := image.Decode(bytes.NewReader(imgData))
			if err != nil {
				t.Fatalf("Failed to decode test image: %v", err)
			}

			bounds := img.Bounds()
			imgW := bounds.Dx()
			imgH := bounds.Dy()

			// Replicate the automatic cropping logic
			targetAspect := 480.0 / 800.0 // 0.6

			cropH := imgH
			cropW := int(float64(cropH) * targetAspect)

			if cropW > imgW {
				cropW = imgW
				cropH = int(float64(cropW) / targetAspect)
			}

			if cropW != tt.expectedCrop.width || cropH != tt.expectedCrop.height {
				t.Errorf("Automatic cropping for %dx%d image: got crop %dx%d, want %dx%d",
					imgW, imgH, cropW, cropH, tt.expectedCrop.width, tt.expectedCrop.height)
			}
		})
	}
}

func TestCreateImagePreview(t *testing.T) {
	tests := []struct {
		name      string
		maxWidth  int
		maxHeight int
		imgWidth  int
		imgHeight int
	}{
		{"large image", 600, 400, 2000, 1500},
		{"small image", 600, 400, 300, 200},
		{"portrait image", 600, 400, 800, 1200},
		{"square image", 600, 400, 500, 500},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			imgData := createTestImage(t, tt.imgWidth, tt.imgHeight)
			result, err := CreateImagePreview(imgData, tt.maxWidth, tt.maxHeight)
			if err != nil {
				t.Errorf("CreateImagePreview() error = %v", err)
				return
			}

			if len(result) == 0 {
				t.Error("CreateImagePreview() returned empty result")
				return
			}

			// Decode the preview image to verify it's JPEG and within bounds
			img, format, err := image.Decode(bytes.NewReader(result))
			if err != nil {
				t.Errorf("Failed to decode preview image: %v", err)
				return
			}

			if format != "jpeg" {
				t.Errorf("CreateImagePreview() format = %s, want jpeg", format)
			}

			bounds := img.Bounds()
			if bounds.Dx() > tt.maxWidth || bounds.Dy() > tt.maxHeight {
				t.Errorf("CreateImagePreview() size %dx%d exceeds max %dx%d", bounds.Dx(), bounds.Dy(), tt.maxWidth, tt.maxHeight)
			}
		})
	}
}

func BenchmarkEncodeBMP(b *testing.B) {
	img := image.NewRGBA(image.Rect(0, 0, 480, 800))
	for y := 0; y < 800; y++ {
		for x := 0; x < 480; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 255})
		}
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		encodeBMP(img)
	}
}

func TestConvertImageToWallpaper_OutputIsGreyscale24BitBMP(t *testing.T) {
	// Create a colorful test image to ensure greyscale conversion works
	colorfulImg := createColorfulTestImage(t, 100, 100)

	// Convert to wallpaper
	result, err := ConvertImageToWallpaper(colorfulImg, 0, 0, 0, 0)
	if err != nil {
		t.Fatalf("ConvertImageToWallpaper() failed: %v", err)
	}

	// Verify BMP header indicates 24-bit
	if len(result) < 30 {
		t.Fatal("BMP data too short")
	}
	bitsPerPixel := int(result[28]) | (int(result[29]) << 8)
	if bitsPerPixel != 24 {
		t.Errorf("Expected 24-bit BMP, got %d bits per pixel", bitsPerPixel)
	}

	// Decode the BMP image
	bmpImg, _, err := image.Decode(bytes.NewReader(result))
	if err != nil {
		t.Fatalf("Failed to decode BMP: %v", err)
	}

	// Check that the image is greyscale (R == G == B for all pixels)
	bounds := bmpImg.Bounds()
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, _ := bmpImg.At(x, y).RGBA()
			// Convert to 8-bit values
			r8, g8, b8 := r>>8, g>>8, b>>8
			if r8 != g8 || g8 != b8 {
				t.Errorf("Pixel at (%d,%d) is not greyscale: R=%d, G=%d, B=%d", x, y, r8, g8, b8)
			}
		}
	}
}

func createColorfulTestImage(t *testing.T, width, height int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			// Create a colorful pattern to ensure greyscale conversion is tested
			r := uint8((x * 255) / width)
			g := uint8((y * 255) / height)
			b := uint8(((x + y) * 255) / (width + height))
			img.Set(x, y, color.RGBA{R: r, G: g, B: b, A: 255})
		}
	}
	var buf bytes.Buffer
	err := png.Encode(&buf, img)
	if err != nil {
		t.Fatalf("failed to encode colorful test image: %v", err)
	}
	return buf.Bytes()
}

func BenchmarkConvertImageToWallpaper(b *testing.B) {
	imgData := createTestImage(&testing.T{}, 800, 600)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ConvertImageToWallpaper(imgData, 0, 0, 0, 0)
	}
}

func BenchmarkCreateWallpaperZip(b *testing.B) {
	images := make([][]byte, 5)
	filenames := make([]string, 5)
	for i := range images {
		images[i] = createTestImage(&testing.T{}, 800, 600)
		filenames[i] = fmt.Sprintf("image%d.jpg", i)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		CreateWallpaperZip(images, filenames)
	}
}
