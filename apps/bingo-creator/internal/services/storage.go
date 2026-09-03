package services

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/maxence-charriere/go-app/v10/pkg/app"
)

// Storage handles persisting state to localStorage
type Storage struct {
	prefix string
}

// TilePool is a named, reusable newline-delimited set of bingo tile text.
type TilePool struct {
	Name  string `json:"name"`
	Items string `json:"items"`
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

// StorageKeyTilePools returns the key containing all reusable tile pools.
func (s *Storage) StorageKeyTilePools() string {
	return fmt.Sprintf("%s_tile_pools", s.prefix)
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

// GetTilePools returns saved pools in a stable alphabetical order. Pools live
// in browser localStorage so they remain available after an app reload.
func (s *Storage) GetTilePools() []TilePool {
	value := app.Window().Get("localStorage").Call("getItem", s.StorageKeyTilePools()).String()
	return ParseTilePools(value)
}

// ParseTilePools converts browser-stored JSON into safe, consistently ordered
// tile pools. Keeping this transformation separate makes reload behavior
// independently testable from the browser localStorage API.
func ParseTilePools(value string) []TilePool {
	if value == "" {
		return []TilePool{}
	}

	var pools []TilePool
	if err := json.Unmarshal([]byte(value), &pools); err != nil {
		return []TilePool{}
	}
	return NormalizeTilePools(pools)
}

// NormalizeTilePools removes unnamed pools, trims names, and sorts the result
// for a stable selector order after each app reload.
func NormalizeTilePools(pools []TilePool) []TilePool {
	validPools := make([]TilePool, 0, len(pools))
	for _, pool := range pools {
		pool.Name = strings.TrimSpace(pool.Name)
		if pool.Name != "" {
			validPools = append(validPools, pool)
		}
	}
	sort.Slice(validPools, func(i, j int) bool {
		return strings.ToLower(validPools[i].Name) < strings.ToLower(validPools[j].Name)
	})
	return validPools
}

// SetTilePool creates or replaces a named reusable pool.
func (s *Storage) SetTilePool(name, items string) {
	name = strings.TrimSpace(name)
	if name == "" {
		return
	}

	pools := s.GetTilePools()
	for i := range pools {
		if pools[i].Name == name {
			pools[i].Items = items
			s.setTilePools(pools)
			return
		}
	}

	pools = append(pools, TilePool{Name: name, Items: items})
	s.setTilePools(pools)
}

// DeleteTilePool removes a saved pool by name.
func (s *Storage) DeleteTilePool(name string) {
	pools := s.GetTilePools()
	for i := range pools {
		if pools[i].Name == name {
			pools = append(pools[:i], pools[i+1:]...)
			break
		}
	}
	s.setTilePools(pools)
}

func (s *Storage) setTilePools(pools []TilePool) {
	data, err := json.Marshal(NormalizeTilePools(pools))
	if err != nil {
		return
	}
	app.Window().Get("localStorage").Call("setItem", s.StorageKeyTilePools(), string(data))
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
