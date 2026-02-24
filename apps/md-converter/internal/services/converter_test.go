package services

import (
	"testing"
)

func TestConvert_BasicFlow(t *testing.T) {
	md := `# Test Document

## First Section
This is the first section.

## Second Section
This is the second section.
`

	result, err := Convert([]byte(md), DevicePresets[0], "Test Document")
	if err != nil {
		t.Fatalf("Convert: %v", err)
	}

	if result.SectionCount != 3 { // Introduction, First Section, Second Section
		t.Errorf("SectionCount = %d, want 3", result.SectionCount)
	}
	if result.EPUBSections != 3 {
		t.Errorf("EPUBSections = %d, want 3", result.EPUBSections)
	}
	if len(result.EPUBData) == 0 {
		t.Error("EPUBData is empty")
	}
}

func TestConvert_InvalidMD(t *testing.T) {
	// Empty data
	_, err := Convert([]byte(""), DevicePresets[0], "Test")
	if err == nil {
		t.Error("want error for empty markdown, got nil")
	}
}

func TestValidateSectionCount_Match(t *testing.T) {
	result := ConversionResult{
		SectionCount: 42,
		EPUBSections: 42,
	}
	if err := ValidateSectionCount(result); err != nil {
		t.Errorf("ValidateSectionCount: unexpected error: %v", err)
	}
}

func TestValidateSectionCount_Mismatch(t *testing.T) {
	result := ConversionResult{
		SectionCount: 10,
		EPUBSections: 9, // simulated mismatch
	}
	if err := ValidateSectionCount(result); err == nil {
		t.Error("want error for mismatched section counts, got nil")
	}
}

func TestValidateSectionCount_ZeroSections(t *testing.T) {
	result := ConversionResult{
		SectionCount: 0,
		EPUBSections: 0,
	}
	if err := ValidateSectionCount(result); err != nil {
		t.Errorf("ValidateSectionCount with 0 sections: unexpected error: %v", err)
	}
}

func TestConvert_AllPresets(t *testing.T) {
	md := `# Test Document
This is a test document.
`

	for _, preset := range DevicePresets {
		t.Run(preset.Name, func(t *testing.T) {
			result, err := Convert([]byte(md), preset, "Preset Test")
			if err != nil {
				t.Fatalf("Convert(%s): %v", preset.Name, err)
			}
			if err := ValidateSectionCount(result); err != nil {
				t.Errorf("ValidateSectionCount(%s): %v", preset.Name, err)
			}
		})
	}
}
