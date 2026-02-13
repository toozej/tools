package services

import (
	"math/rand" // nosemgrep: go.lang.security.audit.crypto.math_random.math-random-used
	"strings"
)

const (
	// FreeSpace is the text displayed in the center cell
	FreeSpace = "Free Space"
	// EmptyCell is the text displayed when there aren't enough items
	EmptyCell = "EMPTY"
)

// Generator handles bingo card generation
type Generator struct {
	rand *rand.Rand
}

// NewGenerator creates a new Generator instance
func NewGenerator() *Generator {
	return &Generator{
		rand: rand.New(rand.NewSource(rand.Int63())),
	}
}

// NormalizeItems processes the raw input items:
// - Trims whitespace from each line
// - Removes empty lines
// - Optionally removes duplicates if dedupe is true
func (g *Generator) NormalizeItems(rawItems string, dedupe bool) []string {
	lines := strings.Split(rawItems, "\n")
	items := make([]string, 0, len(lines))

	seen := make(map[string]bool)

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if dedupe {
			if seen[trimmed] {
				continue
			}
			seen[trimmed] = true
		}
		items = append(items, trimmed)
	}

	return items
}

// Shuffle performs a Fisher-Yates shuffle on the items slice
func (g *Generator) Shuffle(items []string) []string {
	result := make([]string, len(items))
	copy(result, items)

	for i := len(result) - 1; i > 0; i-- {
		j := g.rand.Intn(i + 1)
		result[i], result[j] = result[j], result[i]
	}

	return result
}

// GenerateGrid creates a bingo grid of the specified size with shuffled items
// Center cell is "Free Space", and empty cells are filled with "EMPTY"
func (g *Generator) GenerateGrid(items []string, size int) [][]string {
	// Ensure size is at least 3
	if size < 3 {
		size = 3
	}

	// Shuffle the items
	shuffled := g.Shuffle(items)

	// Calculate the center index
	center := size / 2 // Integer division, 5 -> 2 (0-indexed center)

	// Create the grid
	grid := make([][]string, size)
	for i := range grid {
		grid[i] = make([]string, size)
	}

	// Fill the grid
	itemIndex := 0
	for row := 0; row < size; row++ {
		for col := 0; col < size; col++ {
			if row == center && col == center {
				grid[row][col] = FreeSpace
			} else if itemIndex < len(shuffled) {
				grid[row][col] = shuffled[itemIndex]
				itemIndex++
			} else {
				grid[row][col] = EmptyCell
			}
		}
	}

	return grid
}

// SanitizeFilename removes characters that are not safe for filenames
func SanitizeFilename(name string) string {
	// Replace spaces and special characters with underscores
	result := strings.ReplaceAll(name, " ", "_")
	result = strings.ReplaceAll(result, "-", "_")
	
	// Remove any character that's not alphanumeric or underscore
	var builder strings.Builder
	for _, r := range result {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' {
			builder.WriteRune(r)
		}
	}
	
	return builder.String()
}
