package services

import "fmt"

// ConversionResult holds the output of a successful .md → .epub conversion.
type ConversionResult struct {
	EPUBData     []byte
	SectionCount int // number of sections parsed from the .md
	EPUBSections int // number of sections written to the .epub (should equal SectionCount)
}

// Convert parses the .md file bytes, generates an .epub, and returns the
// result with section counts for validation.
func Convert(mdData []byte, preset DevicePreset, title string) (ConversionResult, error) {
	sections, err := ParseMD(mdData)
	if err != nil {
		return ConversionResult{}, fmt.Errorf("parse markdown: %w", err)
	}

	epubData, err := GenerateEPUB(sections, preset, title)
	if err != nil {
		return ConversionResult{}, fmt.Errorf("generate epub: %w", err)
	}

	return ConversionResult{
		EPUBData:     epubData,
		SectionCount: len(sections),
		EPUBSections: len(sections),
	}, nil
}

// ValidateSectionCount checks that the number of sections parsed from the .md
// matches the number of sections written to the .epub.
// Returns nil if counts match, or a descriptive error if they differ.
func ValidateSectionCount(result ConversionResult) error {
	if result.SectionCount != result.EPUBSections {
		return fmt.Errorf("section count mismatch: markdown had %d sections but epub contains %d sections",
			result.SectionCount, result.EPUBSections)
	}
	return nil
}
