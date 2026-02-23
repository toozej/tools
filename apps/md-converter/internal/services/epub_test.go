package services

import (
	"archive/zip"
	"bytes"
	"strings"
	"testing"
)

func sampleSections() []Section {
	return []Section{
		{ID: 1, Title: "Introduction", Content: "This is the introduction section."},
		{ID: 2, Title: "Getting Started", Content: "This is the getting started section."},
		{ID: 3, Title: "Advanced Topics", Content: "This is the advanced topics section."},
	}
}

func TestGenerateEPUB_ValidZip(t *testing.T) {
	sections := sampleSections()
	data, err := GenerateEPUB(sections, DevicePresets[0], "Test Document")
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

func TestGenerateEPUB_OnePagePerSection(t *testing.T) {
	sections := sampleSections()
	data, err := GenerateEPUB(sections, DevicePresets[0], "Test Document")
	if err != nil {
		t.Fatalf("GenerateEPUB: %v", err)
	}

	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("invalid zip: %v", err)
	}

	// Count section XHTML pages.
	pageCount := 0
	for _, f := range r.File {
		if strings.Contains(f.Name, "section_") && strings.HasSuffix(f.Name, ".xhtml") {
			pageCount++
		}
	}

	if pageCount != len(sections) {
		t.Errorf("section pages: got %d, want %d", pageCount, len(sections))
	}
}

func TestGenerateEPUB_AllDevicePresets(t *testing.T) {
	sections := sampleSections()
	for _, preset := range DevicePresets {
		t.Run(preset.Name, func(t *testing.T) {
			data, err := GenerateEPUB(sections, preset, "Test")
			if err != nil {
				t.Fatalf("GenerateEPUB(%s): %v", preset.Name, err)
			}
			if len(data) == 0 {
				t.Errorf("empty epub for preset %s", preset.Name)
			}
		})
	}
}

func TestGenerateEPUB_EmptySections(t *testing.T) {
	data, err := GenerateEPUB([]Section{}, DevicePresets[0], "Empty Document")
	if err != nil {
		t.Fatalf("GenerateEPUB: %v", err)
	}

	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatalf("invalid zip: %v", err)
	}

	// Should still have structure files but no section pages.
	for _, f := range r.File {
		if strings.HasSuffix(f.Name, "_section.xhtml") || strings.Contains(f.Name, "section_") {
			t.Errorf("unexpected section page in empty document: %s", f.Name)
		}
	}
}

func TestGenerateEPUB_DefaultTitle(t *testing.T) {
	// Empty title should fall back to "Markdown Document".
	data, err := GenerateEPUB(sampleSections(), DevicePresets[0], "")
	if err != nil {
		t.Fatalf("GenerateEPUB: %v", err)
	}
	if len(data) == 0 {
		t.Fatal("empty epub")
	}
}

func TestGenerateEPUB_MimetypeFirst(t *testing.T) {
	data, err := GenerateEPUB(sampleSections(), DevicePresets[0], "Test")
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
		{"html tags preserved", "<b>Bold</b> text", "<b>Bold</b>"},
		{"script removed", "<script>alert(1)</script>safe", "safe"},
		{"style removed", "<style>body {}</style>content", "content"},
		{"br preserved", "line1<br>line2", "<br>"},
		{"html entities", "&lt;test&gt;", "&lt;test&gt;"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeHTML(tt.input)
			if !strings.Contains(got, tt.want) {
				t.Errorf("sanitizeHTML(%q) = %q, want it to contain %q", tt.input, got, tt.want)
			}
			// Script and style tags should never appear.
			if strings.Contains(got, "<script") {
				t.Errorf("sanitizeHTML left script tag in output: %q", got)
			}
			if strings.Contains(got, "<style") {
				t.Errorf("sanitizeHTML left style tag in output: %q", got)
			}
		})
	}
}
