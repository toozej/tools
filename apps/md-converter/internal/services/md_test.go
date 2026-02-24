package services

import (
	"testing"
)

func TestParseMD_BasicSections(t *testing.T) {
	md := `# Introduction
This is the first section.

## Getting Started
This is the second section.

### Installation
This is a sub-section.

## Usage
This is the third section.
`

	sections, err := ParseMD([]byte(md))
	if err != nil {
		t.Fatalf("ParseMD: %v", err)
	}

	expectedTitles := []string{
		"Introduction",
		"Getting Started",
		"Installation",
		"Usage",
	}

	if len(sections) != len(expectedTitles) {
		t.Fatalf("got %d sections, want %d", len(sections), len(expectedTitles))
	}

	for i, section := range sections {
		if section.Title != expectedTitles[i] {
			t.Errorf("section %d title: got %q, want %q", i, section.Title, expectedTitles[i])
		}
		if section.Content == "" {
			t.Errorf("section %d content is empty", i)
		}
	}
}

func TestParseMD_NoHeadings(t *testing.T) {
	md := `This is a Markdown document without any headings.

It has multiple paragraphs.

And some lists:
- Item 1
- Item 2
- Item 3
`

	sections, err := ParseMD([]byte(md))
	if err != nil {
		t.Fatalf("ParseMD: %v", err)
	}

	if len(sections) != 1 {
		t.Fatalf("got %d sections, want 1", len(sections))
	}

	if sections[0].Title != "Introduction" {
		t.Errorf("default title: got %q, want 'Introduction'", sections[0].Title)
	}

	if sections[0].Content == "" {
		t.Errorf("content is empty")
	}
}

func TestParseMD_EmptyContent(t *testing.T) {
	_, err := ParseMD([]byte(""))
	if err == nil {
		t.Error("expected error for empty content")
	}
}

func TestParseMD_GFMFeatures(t *testing.T) {
	md := `# GFM Features

## Tables

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

## Task List

- [x] Completed task
- [ ] Incomplete task

## Code Blocks

    func main() {
        fmt.Println("Hello World")
    }

## Strikethrough

~~This text is strikethrough~~
`

	_, err := ParseMD([]byte(md))
	if err != nil {
		t.Fatalf("ParseMD: %v", err)
	}

	// This test is just to ensure GFM parsing doesn't fail
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (len(substr) == 0 || indexOf(s, substr) != -1)
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
