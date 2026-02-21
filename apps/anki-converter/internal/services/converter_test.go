package services

import (
	"testing"
)

func TestConvert_BasicFlow(t *testing.T) {
	// Build a small test apkg.
	wantCards := []Card{
		{Question: "Q1", Answer: "A1"},
		{Question: "Q2", Answer: "A2"},
	}
	apkgData := buildTestAPKG(t, wantCards)

	result, err := Convert(apkgData, DevicePresets[0], "Test Deck")
	if err != nil {
		t.Fatalf("Convert: %v", err)
	}

	if result.CardCount != len(wantCards) {
		t.Errorf("CardCount = %d, want %d", result.CardCount, len(wantCards))
	}
	if result.EPUBCards != len(wantCards) {
		t.Errorf("EPUBCards = %d, want %d", result.EPUBCards, len(wantCards))
	}
	if len(result.EPUBData) == 0 {
		t.Error("EPUBData is empty")
	}
}

func TestConvert_InvalidAPKG(t *testing.T) {
	_, err := Convert([]byte("not a zip"), DevicePresets[0], "Test")
	if err == nil {
		t.Error("want error for invalid apkg, got nil")
	}
}

func TestValidateCardCount_Match(t *testing.T) {
	result := ConversionResult{
		CardCount: 42,
		EPUBCards: 42,
	}
	if err := ValidateCardCount(result); err != nil {
		t.Errorf("ValidateCardCount: unexpected error: %v", err)
	}
}

func TestValidateCardCount_Mismatch(t *testing.T) {
	result := ConversionResult{
		CardCount: 10,
		EPUBCards: 9, // simulated mismatch
	}
	if err := ValidateCardCount(result); err == nil {
		t.Error("want error for mismatched card counts, got nil")
	}
}

func TestValidateCardCount_ZeroCards(t *testing.T) {
	result := ConversionResult{
		CardCount: 0,
		EPUBCards: 0,
	}
	if err := ValidateCardCount(result); err != nil {
		t.Errorf("ValidateCardCount with 0 cards: unexpected error: %v", err)
	}
}

func TestConvert_AllPresets(t *testing.T) {
	cards := []Card{
		{Question: "Test Q", Answer: "Test A"},
	}
	apkgData := buildTestAPKG(t, cards)

	for _, preset := range DevicePresets {
		t.Run(preset.Name, func(t *testing.T) {
			result, err := Convert(apkgData, preset, "Preset Test")
			if err != nil {
				t.Fatalf("Convert(%s): %v", preset.Name, err)
			}
			if err := ValidateCardCount(result); err != nil {
				t.Errorf("ValidateCardCount(%s): %v", preset.Name, err)
			}
		})
	}
}
