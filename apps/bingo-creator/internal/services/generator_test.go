package services

import "testing"

func TestNormalizeItemsTrimsDropsBlanksAndDeduplicates(t *testing.T) {
	generator := NewGenerator()
	items := generator.NormalizeItems(" first \n\nsecond\n first\n  third  ", true)

	want := []string{"first", "second", "third"}
	if len(items) != len(want) {
		t.Fatalf("item count = %d, want %d", len(items), len(want))
	}
	for index, item := range items {
		if item != want[index] {
			t.Fatalf("item %d = %q, want %q", index, item, want[index])
		}
	}
}

func TestGenerateGridUsesFreeSpaceAndEmptyCells(t *testing.T) {
	generator := NewGenerator()
	grid := generator.GenerateGrid([]string{"one", "two"}, 3)

	if got := grid[1][1]; got != FreeSpace {
		t.Fatalf("center cell = %q, want %q", got, FreeSpace)
	}

	emptyCount := 0
	for rowIndex, row := range grid {
		for columnIndex, cell := range row {
			if rowIndex == 1 && columnIndex == 1 {
				continue
			}
			if cell == EmptyCell {
				emptyCount++
			}
		}
	}
	if emptyCount != 6 {
		t.Fatalf("empty cell count = %d, want 6", emptyCount)
	}
}

func TestShuffleGridPreservesTilesAndFreeSpace(t *testing.T) {
	generator := NewGenerator()
	grid := [][]string{
		{"one", "two", "three"},
		{"four", FreeSpace, "five"},
		{"six", "seven", "eight"},
	}

	shuffled := generator.ShuffleGrid(grid)
	if got := shuffled[1][1]; got != FreeSpace {
		t.Fatalf("center cell = %q, want %q", got, FreeSpace)
	}

	wantTiles := make(map[string]int)
	gotTiles := make(map[string]int)
	for rowIndex, row := range grid {
		for columnIndex, tile := range row {
			if rowIndex == 1 && columnIndex == 1 {
				continue
			}
			wantTiles[tile]++
			gotTiles[shuffled[rowIndex][columnIndex]]++
		}
	}

	for tile, want := range wantTiles {
		if got := gotTiles[tile]; got != want {
			t.Fatalf("tile %q count = %d, want %d", tile, got, want)
		}
	}
}
