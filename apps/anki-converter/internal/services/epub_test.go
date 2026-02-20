package services

import (
	"archive/zip"
	"bytes"
	"strings"
	"testing"
)

func sampleCards() []Card {
	return []Card{
		{ID: 1, Question: "What is Go?", Answer: "A programming language"},
		{ID: 2, Question: "What is EPUB?", Answer: "An e-book format"},
		{ID: 3, Question: "What is Anki?", Answer: "A flashcard app"},
	}
}

func TestGenerateEPUB_ValidZip(t *testing.T) {
	cards := sampleCards()
	data, err := GenerateEPUB(cards, DevicePresets[0], "Test Deck")
	if err != nil {
		t.Fatalf("GenerateEPUB: %v", err)
	}
	if len(data) == 0 {
		t.Fatal("epub data is empty")
	}

	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("epub is not a valid zip: %v", err)
	}

	fileMap := make(map[string]bool)
	for _, f := range r.File {
		fileMap[f.Name] = true
	}

	required := []string{
		"mimetype",
		"META-INF/container.xml",
		"OEBPS/content.opf",
		"OEBPS/nav.xhtml",
		"OEBPS/styles.css",
	}
	for _, name := range required {
		if !fileMap[name] {
			t.Errorf("epub missing required file: %s", name)
		}
	}
}

func TestGenerateEPUB_TwoPagesPerCard(t *testing.T) {
	cards := sampleCards()
	data, err := GenerateEPUB(cards, DevicePresets[0], "Test Deck")
	if err != nil {
		t.Fatalf("GenerateEPUB: %v", err)
	}

	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("invalid zip: %v", err)
	}

	// Count card XHTML pages.
	qCount, aCount := 0, 0
	for _, f := range r.File {
		if strings.Contains(f.Name, "_q.xhtml") {
			qCount++
		}
		if strings.Contains(f.Name, "_a.xhtml") {
			aCount++
		}
	}

	if qCount != len(cards) {
		t.Errorf("question pages: got %d, want %d", qCount, len(cards))
	}
	if aCount != len(cards) {
		t.Errorf("answer pages: got %d, want %d", aCount, len(cards))
	}
}

func TestGenerateEPUB_AllDevicePresets(t *testing.T) {
	cards := sampleCards()
	for _, preset := range DevicePresets {
		t.Run(preset.Name, func(t *testing.T) {
			data, err := GenerateEPUB(cards, preset, "Test")
			if err != nil {
				t.Fatalf("GenerateEPUB(%s): %v", preset.Name, err)
			}
			if len(data) == 0 {
				t.Errorf("empty epub for preset %s", preset.Name)
			}
		})
	}
}

func TestGenerateEPUB_EmptyCards(t *testing.T) {
	data, err := GenerateEPUB([]Card{}, DevicePresets[0], "Empty Deck")
	if err != nil {
		t.Fatalf("GenerateEPUB: %v", err)
	}

	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("invalid zip: %v", err)
	}

	// Should still have structure files but no card pages.
	for _, f := range r.File {
		if strings.HasSuffix(f.Name, "_q.xhtml") || strings.HasSuffix(f.Name, "_a.xhtml") {
			t.Errorf("unexpected card page in empty deck: %s", f.Name)
		}
	}
}

func TestGenerateEPUB_DefaultTitle(t *testing.T) {
	// Empty title should fall back to "Anki Deck".
	data, err := GenerateEPUB(sampleCards(), DevicePresets[0], "")
	if err != nil {
		t.Fatalf("GenerateEPUB: %v", err)
	}
	if len(data) == 0 {
		t.Fatal("empty epub")
	}
}

func TestGenerateEPUB_MimetypeFirst(t *testing.T) {
	data, err := GenerateEPUB(sampleCards(), DevicePresets[0], "Test")
	if err != nil {
		t.Fatalf("GenerateEPUB: %v", err)
	}

	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("invalid zip: %v", err)
	}

	if len(r.File) == 0 {
		t.Fatal("no files in epub")
	}
	if r.File[0].Name != "mimetype" {
		t.Errorf("first file should be 'mimetype', got %q", r.File[0].Name)
	}
	if r.File[0].Method != zip.Store {
		t.Errorf("mimetype should be uncompressed (Store), got method %d", r.File[0].Method)
	}
}

func TestSanitizeHTML(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string // substring that should appear in output
	}{
		{"plain text", "Hello world", "Hello world"},
		{"html tags stripped", "<b>Bold</b> text", "Bold"},
		{"script removed", "<script>alert(1)</script>safe", "safe"},
		{"br to newline", "line1<br>line2", "line1"},
		{"html entities", "&lt;test&gt;", "&lt;test&gt;"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeHTML(tt.input)
			if !strings.Contains(got, tt.want) {
				t.Errorf("sanitizeHTML(%q) = %q, want it to contain %q", tt.input, got, tt.want)
			}
			// Script content should never appear.
			if strings.Contains(got, "<script") {
				t.Errorf("sanitizeHTML left script tag in output: %q", got)
			}
		})
	}
}
