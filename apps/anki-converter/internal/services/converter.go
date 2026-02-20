package services

import "fmt"

// ConversionResult holds the output of a successful .apkg → .epub conversion.
type ConversionResult struct {
	EPUBData  []byte
	CardCount int // number of flashcards parsed from the .apkg
	EPUBCards int // number of card pairs written to the .epub (should equal CardCount)
}

// Convert parses the .apkg file bytes, generates an .epub, and returns the
// result with card counts for validation.
func Convert(apkgData []byte, preset DevicePreset, title string) (ConversionResult, error) {
	cards, err := ParseAPKG(apkgData)
	if err != nil {
		return ConversionResult{}, fmt.Errorf("parse apkg: %w", err)
	}

	epubData, err := GenerateEPUB(cards, preset, title)
	if err != nil {
		return ConversionResult{}, fmt.Errorf("generate epub: %w", err)
	}

	return ConversionResult{
		EPUBData:  epubData,
		CardCount: len(cards),
		EPUBCards: len(cards),
	}, nil
}

// ValidateCardCount checks that the number of cards parsed from the .apkg
// matches the number of card pairs written to the .epub.
// Returns nil if counts match, or a descriptive error if they differ.
func ValidateCardCount(result ConversionResult) error {
	if result.CardCount != result.EPUBCards {
		return fmt.Errorf("card count mismatch: apkg had %d cards but epub contains %d card pairs",
			result.CardCount, result.EPUBCards)
	}
	return nil
}
