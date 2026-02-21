package services

import (
	"archive/zip"
	"bytes"
	"encoding/binary"
	"testing"
)

// buildTestAPKG creates a minimal .apkg byte slice containing a small SQLite
// database with the provided cards. Uses buildTestDB to generate the SQLite
// binary without any external dependencies.
func buildTestAPKG(t *testing.T, cards []Card) []byte {
	t.Helper()
	dbBytes := buildTestDB(t, cards)

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	f, err := zw.Create("collection.anki21")
	if err != nil {
		t.Fatalf("create zip entry: %v", err)
	}
	if _, err := f.Write(dbBytes); err != nil {
		t.Fatalf("write zip entry: %v", err)
	}
	if err := zw.Close(); err != nil {
		t.Fatalf("close zip: %v", err)
	}
	return buf.Bytes()
}

// buildTestDB constructs a minimal valid SQLite3 database binary with a
// "notes" table containing the given cards.
//
// Structure:
//   - Page 1 (100-byte DB header + B-tree leaf for sqlite_master)
//   - Page 2 (B-tree leaf for the notes table)
//
// sqlite_master contains one row: the notes table definition pointing to page 2.
func buildTestDB(t *testing.T, cards []Card) []byte {
	t.Helper()

	const pageSize = 4096

	// Build the notes table cells for page 2.
	notesCells := make([][]byte, 0, len(cards))
	for i, c := range cards {
		rowid := int64(i + 1)
		flds := c.Question + "\x1f" + c.Answer
		notesCells = append(notesCells, buildCell(t, rowid, []interface{}{rowid, flds}))
	}

	// sqlite_master row: type="table", name="notes", tbl_name="notes", rootpage=2, sql=...
	sql := `CREATE TABLE notes (id INTEGER PRIMARY KEY, flds TEXT NOT NULL)`
	masterCell := buildCell(t, 1, []interface{}{"table", "notes", "notes", int64(2), sql})

	// Page 1: 100-byte DB file header + 8-byte B-tree leaf header + cells.
	// Page 2: 8-byte B-tree leaf header + cells.

	page1 := make([]byte, pageSize)
	page2 := make([]byte, pageSize)

	// --- 100-byte SQLite file header on page 1 ---
	copy(page1[0:16], "SQLite format 3\x00")
	binary.BigEndian.PutUint16(page1[16:18], uint16(pageSize))
	page1[18] = 1 // write format
	page1[19] = 1 // read format
	page1[20] = 0 // reserved bytes per page
	page1[21] = 64
	page1[22] = 32
	page1[23] = 32
	binary.BigEndian.PutUint32(page1[24:28], 1)        // change counter
	binary.BigEndian.PutUint32(page1[28:32], 2)        // number of pages
	binary.BigEndian.PutUint32(page1[36:40], 0)        // free pages
	binary.BigEndian.PutUint32(page1[40:44], 1)        // schema cookie
	binary.BigEndian.PutUint32(page1[44:48], 4)        // schema format
	binary.BigEndian.PutUint32(page1[56:60], 1)        // text encoding = UTF-8
	binary.BigEndian.PutUint32(page1[92:96], 2)        // version-valid-for
	binary.BigEndian.PutUint32(page1[96:100], 3046000) // SQLite version number

	// --- B-tree leaf headers (page 1 at offset 100, page 2 at offset 0) ---
	writeCellsToPage(t, page1, 100, [][]byte{masterCell})
	writeCellsToPage(t, page2, 0, notesCells)

	db := make([]byte, pageSize*2)
	copy(db[0:pageSize], page1)
	copy(db[pageSize:], page2)
	return db
}

// writeCellsToPage writes the B-tree leaf header and cell data into page at
// the given headerOffset. Cells are placed from the end of the page backwards.
func writeCellsToPage(t *testing.T, page []byte, headerOffset int, cells [][]byte) {
	t.Helper()
	pageSize := len(page)

	// Place cells from the end of the page backwards.
	contentStart := pageSize
	cellPointers := make([]uint16, len(cells))
	for i, cell := range cells {
		contentStart -= len(cell)
		if contentStart < headerOffset+8+len(cells)*2 {
			t.Fatalf("cells too large to fit in page")
		}
		copy(page[contentStart:], cell)
		cellPointers[i] = uint16(contentStart)
	}

	// B-tree leaf header: type(1) + freeblock(2) + numCells(2) + contentStart(2) + fragBytes(1)
	page[headerOffset+0] = 0x0d                                           // leaf table B-tree page type
	binary.BigEndian.PutUint16(page[headerOffset+1:], 0)                  // first freeblock = none
	binary.BigEndian.PutUint16(page[headerOffset+3:], uint16(len(cells))) // number of cells
	contentWord := uint16(contentStart)
	if contentStart == pageSize {
		contentWord = 0 // 0 means 65536
	}
	binary.BigEndian.PutUint16(page[headerOffset+5:], contentWord) // content area start
	page[headerOffset+7] = 0                                       // fragmented free bytes

	// Cell pointer array starts right after the 8-byte header.
	for i, ptr := range cellPointers {
		binary.BigEndian.PutUint16(page[headerOffset+8+i*2:], ptr)
	}
}

// buildCell encodes a single SQLite3 table leaf cell.
// Format: varint(payloadSize) + varint(rowid) + record
func buildCell(t *testing.T, rowid int64, values []interface{}) []byte {
	t.Helper()
	record := encodeRecord(t, values)
	var cell bytes.Buffer
	cell.Write(encodeVarint(int64(len(record))))
	cell.Write(encodeVarint(rowid))
	cell.Write(record)
	return cell.Bytes()
}

// encodeRecord encodes a SQLite3 record (header + body).
func encodeRecord(t *testing.T, values []interface{}) []byte {
	t.Helper()

	var serialTypes []byte
	var body bytes.Buffer

	for _, v := range values {
		switch val := v.(type) {
		case nil:
			serialTypes = append(serialTypes, 0x00) // NULL = serial type 0
		case int64:
			if val == 0 {
				serialTypes = append(serialTypes, 0x08) // integer 0
			} else if val >= -128 && val <= 127 {
				serialTypes = append(serialTypes, 0x01)
				body.WriteByte(byte(int8(val)))
			} else if val >= -32768 && val <= 32767 {
				serialTypes = append(serialTypes, 0x02)
				var b [2]byte
				binary.BigEndian.PutUint16(b[:], uint16(int16(val)))
				body.Write(b[:])
			} else if val >= -(1<<31) && val <= (1<<31)-1 {
				serialTypes = append(serialTypes, 0x04)
				var b [4]byte
				binary.BigEndian.PutUint32(b[:], uint32(int32(val)))
				body.Write(b[:])
			} else {
				serialTypes = append(serialTypes, 0x06)
				var b [8]byte
				binary.BigEndian.PutUint64(b[:], uint64(val))
				body.Write(b[:])
			}
		case string:
			n := len(val)
			serialType := int64(13 + n*2)
			serialTypes = append(serialTypes, encodeVarint(serialType)...)
			body.WriteString(val)
		default:
			t.Fatalf("encodeRecord: unsupported type %T", v)
		}
	}

	// Header: varint(1 + len(serialTypes)) + serialTypes
	// For our test data this always fits in 1 byte (< 128).
	headerSizeEncoded := encodeVarint(int64(1 + len(serialTypes)))
	if len(headerSizeEncoded) > 1 {
		t.Fatalf("header size varint unexpectedly large: %d bytes", len(headerSizeEncoded))
	}

	var rec bytes.Buffer
	rec.Write(headerSizeEncoded)
	rec.Write(serialTypes)
	rec.Write(body.Bytes())
	return rec.Bytes()
}

// encodeVarint encodes an int64 as a SQLite varint (1–9 bytes).
func encodeVarint(v int64) []byte {
	u := uint64(v)
	if u <= 0x7f {
		return []byte{byte(u)}
	}
	if u <= 0x3fff {
		return []byte{byte((u>>7)&0x7f | 0x80), byte(u & 0x7f)}
	}
	// For values up to 2097151 (3 bytes).
	if u <= 0x1fffff {
		return []byte{
			byte((u>>14)&0x7f | 0x80),
			byte((u>>7)&0x7f | 0x80),
			byte(u & 0x7f),
		}
	}
	// General case: build bytes from LSB.
	var buf [9]byte
	n := 0
	for u > 0 || n == 0 {
		if n < 8 {
			buf[8-n] = byte(u&0x7f) | 0x80
		} else {
			buf[8-n] = byte(u & 0xff)
		}
		u >>= 7
		n++
	}
	// Clear the high bit of the last byte.
	buf[8] &= 0x7f
	return buf[8-n+1 : 9]
}

// ── Actual tests ──────────────────────────────────────────────────────────────

func TestParseAPKG_BasicCards(t *testing.T) {
	wantCards := []Card{
		{Question: "What is the capital of France?", Answer: "Paris"},
		{Question: "What is 2 + 2?", Answer: "4"},
		{Question: "Who wrote Hamlet?", Answer: "Shakespeare"},
	}

	apkgData := buildTestAPKG(t, wantCards)
	got, err := ParseAPKG(apkgData)
	if err != nil {
		t.Fatalf("ParseAPKG: %v", err)
	}

	if len(got) != len(wantCards) {
		t.Fatalf("got %d cards, want %d", len(got), len(wantCards))
	}

	for i, c := range got {
		if c.Question != wantCards[i].Question {
			t.Errorf("card %d: question = %q, want %q", i, c.Question, wantCards[i].Question)
		}
		if c.Answer != wantCards[i].Answer {
			t.Errorf("card %d: answer = %q, want %q", i, c.Answer, wantCards[i].Answer)
		}
	}
}

func TestParseAPKG_EmptyDeck(t *testing.T) {
	apkgData := buildTestAPKG(t, []Card{})
	got, err := ParseAPKG(apkgData)
	if err != nil {
		t.Fatalf("ParseAPKG: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("want 0 cards, got %d", len(got))
	}
}

func TestParseAPKG_FieldSeparator(t *testing.T) {
	apkgData := buildTestAPKG(t, []Card{
		{Question: "front", Answer: "back"},
	})
	got, err := ParseAPKG(apkgData)
	if err != nil {
		t.Fatalf("ParseAPKG: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("want 1 card, got %d", len(got))
	}
	if got[0].Question != "front" {
		t.Errorf("question = %q", got[0].Question)
	}
	if got[0].Answer != "back" {
		t.Errorf("answer = %q", got[0].Answer)
	}
}

func TestParseAPKG_EmptyData(t *testing.T) {
	_, err := ParseAPKG([]byte{})
	if err == nil {
		t.Error("want error for empty data, got nil")
	}
}

func TestParseAPKG_InvalidZip(t *testing.T) {
	_, err := ParseAPKG([]byte("this is not a zip file"))
	if err == nil {
		t.Error("want error for invalid zip, got nil")
	}
}

func TestParseAPKG_NoCollectionDB(t *testing.T) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	f, _ := zw.Create("media")
	_, _ = f.Write([]byte("{}"))
	_ = zw.Close()

	_, err := ParseAPKG(buf.Bytes())
	if err == nil {
		t.Error("want error when no collection db found")
	}
}

func TestParseAPKG_FallbackToAnki2(t *testing.T) {
	wantCards := []Card{
		{Question: "Legacy Q", Answer: "Legacy A"},
	}
	dbBytes := buildTestDB(t, wantCards)

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	f, _ := zw.Create("collection.anki2") // legacy filename
	_, _ = f.Write(dbBytes)
	_ = zw.Close()

	got, err := ParseAPKG(buf.Bytes())
	if err != nil {
		t.Fatalf("ParseAPKG: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("want 1 card, got %d", len(got))
	}
	if got[0].Question != "Legacy Q" {
		t.Errorf("question = %q", got[0].Question)
	}
}
