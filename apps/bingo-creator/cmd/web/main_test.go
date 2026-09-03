package main

import (
	"testing"

	"bingo-creator/internal/services"
)

func TestTilePoolNameFromFilename(t *testing.T) {
	tests := []struct {
		filename string
		want     string
	}{
		{filename: "road-trip.txt", want: "road-trip"},
		{filename: "  party.tiles.txt  ", want: "party.tiles"},
		{filename: "tiles", want: "tiles"},
		{filename: "", want: "Imported tiles"},
	}

	for _, test := range tests {
		t.Run(test.filename, func(t *testing.T) {
			if got := tilePoolNameFromFilename(test.filename); got != test.want {
				t.Fatalf("tilePoolNameFromFilename(%q) = %q, want %q", test.filename, got, test.want)
			}
		})
	}
}

func TestResetMarksStartsTabletCardWithMarkedFreeSpace(t *testing.T) {
	home := &home{
		gridSize:   5,
		grid:       make([][]string, 5),
		tabletMode: true,
	}
	home.resetMarks()

	if len(home.markedCells) != 1 || !home.markedCells[12] {
		t.Fatalf("marked cells = %#v, want only the center free space", home.markedCells)
	}

	home.tabletMode = false
	home.resetMarks()
	if len(home.markedCells) != 0 {
		t.Fatalf("marked cells outside tablet mode = %#v, want none", home.markedCells)
	}
}

func TestGridToJSConvertsRowsAndCells(t *testing.T) {
	grid := [][]string{{"one", "two"}, {"three", services.FreeSpace}}
	rows := gridToJS(grid)

	if len(rows) != 2 {
		t.Fatalf("row count = %d, want 2", len(rows))
	}
	firstRow, ok := rows[0].([]any)
	if !ok {
		t.Fatalf("first row has type %T, want []any", rows[0])
	}
	if firstRow[1] != "two" {
		t.Fatalf("first row second cell = %#v, want %q", firstRow[1], "two")
	}
}
