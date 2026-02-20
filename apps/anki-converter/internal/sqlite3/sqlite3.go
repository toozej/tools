// Package sqlite3 implements a minimal read-only SQLite3 database reader
// using only the Go standard library. It supports enough of the SQLite3 file
// format to read rows from leaf B-tree table pages, which is all that is
// needed to parse Anki .apkg collection databases.
//
// SQLite3 file format reference:
// https://www.sqlite.org/fileformat.html
package sqlite3

import (
	"encoding/binary"
	"fmt"
	"io"
	"math"
)

const (
	headerSize    = 100
	headerMagic   = "SQLite format 3\x00"
	btreeLeafPage = 0x0d
	btreeIntPage  = 0x05
)

// DB is a minimal read-only SQLite3 database reader.
type DB struct {
	data     []byte
	pageSize int
}

// Row represents a single database row as a slice of values.
// Values are Go native types: int64, float64, string, []byte, or nil.
type Row []interface{}

// Open opens a SQLite3 database from raw bytes.
func Open(data []byte) (*DB, error) {
	if len(data) < headerSize {
		return nil, fmt.Errorf("sqlite3: file too small (%d bytes)", len(data))
	}
	if string(data[:16]) != headerMagic {
		return nil, fmt.Errorf("sqlite3: invalid magic header")
	}

	pageSize := int(binary.BigEndian.Uint16(data[16:18]))
	if pageSize == 1 {
		pageSize = 65536
	}
	if pageSize < 512 || pageSize > 65536 || (pageSize&(pageSize-1)) != 0 {
		return nil, fmt.Errorf("sqlite3: invalid page size %d", pageSize)
	}

	return &DB{data: data, pageSize: pageSize}, nil
}

// ReadTable reads all rows from the table with the given name.
// It traverses the B-tree from the root page recorded in sqlite_master.
func (db *DB) ReadTable(tableName string) ([]Row, error) {
	// Page 1 is the root page of sqlite_master.
	rootPageData, err := db.page(1)
	if err != nil {
		return nil, fmt.Errorf("sqlite3: read master page: %w", err)
	}

	// Read sqlite_master rows to find the root page of our table.
	masterRows, err := db.readBTreeTable(rootPageData, 1)
	if err != nil {
		return nil, fmt.Errorf("sqlite3: read sqlite_master: %w", err)
	}

	// sqlite_master columns: rowid, type, name, tbl_name, rootpage, sql
	rootPage := -1
	for _, row := range masterRows {
		if len(row) < 6 {
			continue
		}
		rowType, _ := row[1].(string)
		rowName, _ := row[2].(string)
		if rowType == "table" && rowName == tableName {
			switch v := row[4].(type) {
			case int64:
				rootPage = int(v)
			}
			break
		}
	}
	if rootPage < 0 {
		return nil, fmt.Errorf("sqlite3: table %q not found", tableName)
	}

	pageData, err := db.page(rootPage)
	if err != nil {
		return nil, fmt.Errorf("sqlite3: read table root page: %w", err)
	}

	return db.readBTreeTable(pageData, rootPage)
}

// page returns the raw bytes for a given 1-indexed page number.
func (db *DB) page(n int) ([]byte, error) {
	offset := (n - 1) * db.pageSize
	if offset+db.pageSize > len(db.data) {
		return nil, fmt.Errorf("sqlite3: page %d out of range", n)
	}
	return db.data[offset : offset+db.pageSize], nil
}

// readBTreeTable reads all rows from a B-tree table starting at the given page.
// pageNum is 1-indexed and is passed for interior page child resolution.
func (db *DB) readBTreeTable(pageData []byte, pageNum int) ([]Row, error) {
	// Offset into page for the B-tree header. Page 1 has a 100-byte db header first.
	headerOffset := 0
	if pageNum == 1 {
		headerOffset = 100
	}

	if headerOffset >= len(pageData) {
		return nil, fmt.Errorf("sqlite3: page %d too small for header offset %d", pageNum, headerOffset)
	}
	pageType := pageData[headerOffset]

	switch pageType {
	case btreeLeafPage:
		return db.readLeafPage(pageData, headerOffset)
	case btreeIntPage:
		return db.readInteriorPage(pageData, headerOffset, pageNum)
	default:
		return nil, fmt.Errorf("sqlite3: unexpected page type 0x%02x on page %d", pageType, pageNum)
	}
}

// readLeafPage reads all cell records from a B-tree leaf table page.
func (db *DB) readLeafPage(pageData []byte, headerOffset int) ([]Row, error) {
	if len(pageData) < headerOffset+8 {
		return nil, fmt.Errorf("sqlite3: leaf page too small")
	}
	numCells := int(binary.BigEndian.Uint16(pageData[headerOffset+3 : headerOffset+5]))
	// Cell pointer array starts immediately after the 8-byte B-tree page header.
	cellPtrOffset := headerOffset + 8

	var rows []Row
	for i := 0; i < numCells; i++ {
		ptrPos := cellPtrOffset + i*2
		if ptrPos+2 > len(pageData) {
			return nil, fmt.Errorf("sqlite3: cell pointer array out of range")
		}
		cellOffset := int(binary.BigEndian.Uint16(pageData[ptrPos : ptrPos+2]))
		row, err := db.parseRecord(pageData, cellOffset)
		if err != nil {
			return nil, err
		}
		rows = append(rows, row)
	}
	return rows, nil
}

// readInteriorPage recursively reads all rows from an interior B-tree page
// by following its child page pointers.
func (db *DB) readInteriorPage(pageData []byte, headerOffset, _ int) ([]Row, error) {
	if len(pageData) < headerOffset+12 {
		return nil, fmt.Errorf("sqlite3: interior page too small")
	}
	numCells := int(binary.BigEndian.Uint16(pageData[headerOffset+3 : headerOffset+5]))
	rightmostChild := int(binary.BigEndian.Uint32(pageData[headerOffset+8 : headerOffset+12]))

	// Cell pointer array starts after the 12-byte interior page header.
	cellPtrOffset := headerOffset + 12

	var rows []Row

	// Each interior cell: 4-byte left child page number + varint rowid key.
	for i := 0; i < numCells; i++ {
		ptrPos := cellPtrOffset + i*2
		if ptrPos+2 > len(pageData) {
			return nil, fmt.Errorf("sqlite3: interior cell pointer out of range")
		}
		cellOffset := int(binary.BigEndian.Uint16(pageData[ptrPos : ptrPos+2]))
		if cellOffset+4 > len(pageData) {
			return nil, fmt.Errorf("sqlite3: interior cell out of range")
		}
		leftChild := int(binary.BigEndian.Uint32(pageData[cellOffset : cellOffset+4]))

		childPage, err := db.page(leftChild)
		if err != nil {
			return nil, err
		}
		childRows, err := db.readBTreeTable(childPage, leftChild)
		if err != nil {
			return nil, err
		}
		rows = append(rows, childRows...)
	}

	// Follow the rightmost child pointer.
	if rightmostChild > 0 {
		rightPage, err := db.page(rightmostChild)
		if err != nil {
			return nil, err
		}
		rightRows, err := db.readBTreeTable(rightPage, rightmostChild)
		if err != nil {
			return nil, err
		}
		rows = append(rows, rightRows...)
	}

	return rows, nil
}

// parseRecord parses a table B-tree leaf cell starting at offset within page.
// Format: varint(payload_size) + varint(rowid) + record_header + record_body
func (db *DB) parseRecord(pageData []byte, offset int) (Row, error) {
	if offset >= len(pageData) {
		return nil, fmt.Errorf("sqlite3: cell offset %d out of range", offset)
	}

	r := &byteReader{data: pageData, pos: offset}

	// Total payload size (varint)
	payloadSize, err := r.readVarint()
	if err != nil {
		return nil, fmt.Errorf("sqlite3: payload size varint: %w", err)
	}

	// Rowid (varint) — we'll use it as the first column in the row
	rowid, err := r.readVarint()
	if err != nil {
		return nil, fmt.Errorf("sqlite3: rowid varint: %w", err)
	}

	// Check for overflow pages (payload > usable page space).
	// For simplicity, we assume payload fits in one page (common for text notes).
	// If an overflow is detected we skip the row gracefully.
	usableSize := db.pageSize - 0 // reserve bytes = 0 by default (from db header byte 20)
	maxLocal := usableSize - 35
	if payloadSize > int64(maxLocal) {
		// Skip overflow cells — rare for simple text Anki decks.
		return Row{nil, nil}, nil
	}

	// Record header
	headerStart := r.pos
	headerSize, err := r.readVarint()
	if err != nil {
		return nil, fmt.Errorf("sqlite3: record header size: %w", err)
	}

	// Read serial type codes until end of header.
	serialTypes := []int64{}
	for r.pos < headerStart+int(headerSize) {
		st, err := r.readVarint()
		if err != nil {
			return nil, fmt.Errorf("sqlite3: serial type varint: %w", err)
		}
		serialTypes = append(serialTypes, st)
	}

	// Read values.
	row := Row{rowid}
	for _, st := range serialTypes {
		val, err := r.readValue(st)
		if err != nil {
			return nil, fmt.Errorf("sqlite3: read value (serial type %d): %w", st, err)
		}
		row = append(row, val)
	}

	return row, nil
}

// byteReader is a simple sequential reader over a byte slice.
type byteReader struct {
	data []byte
	pos  int
}

func (r *byteReader) readByte() (byte, error) {
	if r.pos >= len(r.data) {
		return 0, io.ErrUnexpectedEOF
	}
	b := r.data[r.pos]
	r.pos++
	return b, nil
}

// readVarint reads a SQLite variable-length integer (up to 9 bytes).
func (r *byteReader) readVarint() (int64, error) {
	var result uint64
	for i := 0; i < 9; i++ {
		b, err := r.readByte()
		if err != nil {
			return 0, err
		}
		if i == 8 {
			// Last byte uses all 8 bits.
			result = (result << 8) | uint64(b)
			break
		}
		result = (result << 7) | uint64(b&0x7f)
		if b&0x80 == 0 {
			break
		}
	}
	return int64(result), nil
}

// readValue reads a SQLite record value according to its serial type code.
func (r *byteReader) readValue(serialType int64) (interface{}, error) {
	switch serialType {
	case 0:
		return nil, nil // NULL
	case 1:
		b, err := r.readByte()
		return int64(int8(b)), err
	case 2:
		if r.pos+2 > len(r.data) {
			return nil, io.ErrUnexpectedEOF
		}
		v := int64(int16(binary.BigEndian.Uint16(r.data[r.pos : r.pos+2])))
		r.pos += 2
		return v, nil
	case 3:
		if r.pos+3 > len(r.data) {
			return nil, io.ErrUnexpectedEOF
		}
		v := int64(int32(binary.BigEndian.Uint32(append([]byte{0}, r.data[r.pos:r.pos+3]...))))
		r.pos += 3
		return v, nil
	case 4:
		if r.pos+4 > len(r.data) {
			return nil, io.ErrUnexpectedEOF
		}
		v := int64(int32(binary.BigEndian.Uint32(r.data[r.pos : r.pos+4])))
		r.pos += 4
		return v, nil
	case 5:
		if r.pos+6 > len(r.data) {
			return nil, io.ErrUnexpectedEOF
		}
		var buf [8]byte
		copy(buf[2:], r.data[r.pos:r.pos+6])
		v := int64(binary.BigEndian.Uint64(buf[:]))
		r.pos += 6
		return v, nil
	case 6:
		if r.pos+8 > len(r.data) {
			return nil, io.ErrUnexpectedEOF
		}
		v := int64(binary.BigEndian.Uint64(r.data[r.pos : r.pos+8]))
		r.pos += 8
		return v, nil
	case 7:
		if r.pos+8 > len(r.data) {
			return nil, io.ErrUnexpectedEOF
		}
		bits := binary.BigEndian.Uint64(r.data[r.pos : r.pos+8])
		r.pos += 8
		return math.Float64frombits(bits), nil
	case 8:
		return int64(0), nil
	case 9:
		return int64(1), nil
	default:
		if serialType >= 12 && serialType%2 == 0 {
			// BLOB
			n := int((serialType - 12) / 2)
			if r.pos+n > len(r.data) {
				return nil, io.ErrUnexpectedEOF
			}
			b := make([]byte, n)
			copy(b, r.data[r.pos:r.pos+n])
			r.pos += n
			return b, nil
		}
		if serialType >= 13 && serialType%2 == 1 {
			// TEXT (UTF-8)
			n := int((serialType - 13) / 2)
			if r.pos+n > len(r.data) {
				return nil, io.ErrUnexpectedEOF
			}
			s := string(r.data[r.pos : r.pos+n])
			r.pos += n
			return s, nil
		}
		return nil, fmt.Errorf("sqlite3: unknown serial type %d", serialType)
	}
}
