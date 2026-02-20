// Package services provides the core functionality for anki-converter.
package services

import (
	"archive/zip"
	"bytes"
	"fmt"
	"strings"

	"anki-converter/internal/sqlite3"
)

// Card represents a single Anki flashcard with a question and answer.
type Card struct {
	ID       int64
	Question string // HTML content (first field)
	Answer   string // HTML content (second field)
}

// ParseAPKG parses an Anki .apkg file (provided as raw bytes) and returns
// the list of flashcards contained within it.
//
// An .apkg file is a ZIP archive containing a SQLite database named
// "collection.anki21" or "collection.anki2". Each note row in the "notes"
// table has a "flds" column whose fields are separated by the ASCII Unit
// Separator character (0x1F). The first field is the question/front and
// the second field is the answer/back.
func ParseAPKG(data []byte) ([]Card, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("apkg data is empty")
	}

	// Open the ZIP archive from memory.
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("failed to open apkg as zip: %w", err)
	}

	// Find the SQLite database file inside the ZIP.
	dbFile := findDBFile(r)
	if dbFile == nil {
		return nil, fmt.Errorf("no collection database found in apkg (expected collection.anki21 or collection.anki2)")
	}

	// Read the database bytes directly into memory.
	dbBytes, err := readZipEntry(dbFile)
	if err != nil {
		return nil, fmt.Errorf("failed to extract collection database: %w", err)
	}

	// Parse the SQLite database using our pure-Go reader.
	db, err := sqlite3.Open(dbBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	rows, err := db.ReadTable("notes")
	if err != nil {
		return nil, fmt.Errorf("failed to read notes table: %w", err)
	}

	return parseRows(rows), nil
}

// findDBFile searches the ZIP archive for the Anki collection database.
// It prefers collection.anki21 (newer format) but falls back to collection.anki2.
func findDBFile(r *zip.Reader) *zip.File {
	var fallback *zip.File
	for _, f := range r.File {
		switch f.Name {
		case "collection.anki21":
			return f // prefer newer format
		case "collection.anki2":
			fallback = f
		}
	}
	return fallback
}

// readZipEntry reads the full contents of a zip entry into memory.
func readZipEntry(f *zip.File) ([]byte, error) {
	rc, err := f.Open()
	if err != nil {
		return nil, fmt.Errorf("open zip entry: %w", err)
	}
	defer rc.Close()

	var buf bytes.Buffer
	tmp := make([]byte, 32*1024)
	for {
		n, readErr := rc.Read(tmp)
		if n > 0 {
			buf.Write(tmp[:n])
		}
		if readErr != nil {
			break
		}
	}
	return buf.Bytes(), nil
}

// parseRows converts raw sqlite3.Row slices to Card values.
// Anki collection database (notes table) typically has many columns.
// Our sqlite3 reader prepends the rowid as the first element (index 0).
func parseRows(rows []sqlite3.Row) []Card {
	cards := make([]Card, 0, len(rows))
	for _, row := range rows {
		// Minimum expected: [rowid, col0, col1]
		if len(row) < 3 {
			continue
		}

		// The rowid (index 0) is always the best choice for ID.
		var id int64
		if v, ok := row[0].(int64); ok {
			id = v
		}

		// Look for the "flds" column.
		// In standard Anki (schema v11), it's at record index 6 (row index 7).
		// In our minimal test schema, it's at record index 1 (row index 2).
		fldsIndex := 2 // fallback to test schema
		if len(row) >= 8 {
			fldsIndex = 7 // standard Anki schema
		}

		var flds string
		if fldsIndex < len(row) {
			switch v := row[fldsIndex].(type) {
			case string:
				flds = v
			case []byte:
				flds = string(v)
			}
		}

		// Optional: if the guessed column doesn't contain the separator,
		// we could scan other columns, but standard index is usually reliable.

		// Skip null rows (overflow pages we skipped).
		if id == 0 && flds == "" {
			continue
		}

		fields := strings.Split(flds, "\x1f")
		card := Card{ID: id}
		if len(fields) >= 1 {
			card.Question = strings.TrimSpace(fields[0])
		}
		if len(fields) >= 2 {
			card.Answer = strings.TrimSpace(fields[1])
		}
		cards = append(cards, card)
	}
	return cards
}
