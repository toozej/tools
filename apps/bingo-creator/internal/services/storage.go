package services

import (
	"fmt"
	"strconv"

	"github.com/maxence-charriere/go-app/v10/pkg/app"
)

// Storage handles persisting state to localStorage
type Storage struct {
	prefix string
}

// NewStorage creates a new Storage instance
func NewStorage() *Storage {
	return &Storage{
		prefix: "bingo-creator",
	}
}

// StorageKey returns the full key for localStorage
func (s *Storage) StorageKey(tripName string) string {
	sanitized := SanitizeFilename(tripName)
	return fmt.Sprintf("%s_count_%s", s.prefix, sanitized)
}

// StorageKeyItems returns the full key for storing items
func (s *Storage) StorageKeyItems(tripName string) string {
	sanitized := SanitizeFilename(tripName)
	return fmt.Sprintf("%s_items_%s", s.prefix, sanitized)
}

// GetCount retrieves the export count for a trip name from localStorage
func (s *Storage) GetCount(tripName string) int {
	key := s.StorageKey(tripName)
	value := app.Window().Get("localStorage").Call("getItem", key).String()
	if value == "" {
		return 0
	}

	count, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return count
}

// IncrementCount increments the export count for a trip name
func (s *Storage) IncrementCount(tripName string) int {
	count := s.GetCount(tripName) + 1
	key := s.StorageKey(tripName)
	app.Window().Get("localStorage").Call("setItem", key, count)
	return count
}

// SetItems stores the items for a trip name
func (s *Storage) SetItems(tripName string, items string) {
	key := s.StorageKeyItems(tripName)
	app.Window().Get("localStorage").Call("setItem", key, items)
}

// GetItems retrieves the items for a trip name from localStorage
func (s *Storage) GetItems(tripName string) string {
	key := s.StorageKeyItems(tripName)
	value := app.Window().Get("localStorage").Call("getItem", key).String()
	return value
}

// GenerateFilename creates the PDF filename for an export
func (s *Storage) GenerateFilename(tripName string) string {
	sanitized := SanitizeFilename(tripName)
	count := s.IncrementCount(tripName)
	return fmt.Sprintf("bingo_card_%s_%d.pdf", sanitized, count)
}

// GetAvailableGridSizes returns the available grid sizes
func GetAvailableGridSizes() []int {
	return []int{3, 4, 5, 6, 7, 8, 9, 10}
}

// GridSizeLabels returns human-readable labels for grid sizes
func GridSizeLabel(size int) string {
	return fmt.Sprintf("%dx%d", size, size)
}

// ParseGridSizes returns formatted options for select dropdown
func ParseGridSizes() []string {
	sizes := GetAvailableGridSizes()
	labels := make([]string, len(sizes))
	for i, size := range sizes {
		labels[i] = GridSizeLabel(size)
	}
	return labels
}

// JoinGridSizes creates a comma-separated string for validation
func JoinGridSizes() string {
	sizes := GetAvailableGridSizes()
	result := make([]string, len(sizes))
	for i, size := range sizes {
		result[i] = strconv.Itoa(size)
	}
	return fmt.Sprintf("%v", result)
}
