// Package services provides the core functionality for md-converter.
package services

import (
	"fmt"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	"github.com/yuin/goldmark/renderer/html"
)

// Section represents a section of Markdown content with title and HTML content.
type Section struct {
	ID      int64
	Title   string // Section title (from heading)
	Content string // HTML content of the section
}

// ParseMD parses a Markdown .md file (provided as raw bytes) and returns
// the list of sections contained within it.
//
// The Markdown is parsed using GitHub Flavored Markdown (GFM) specifications,
// which includes support for tables, task lists, strikethrough, and other GFM features.
func ParseMD(data []byte) ([]Section, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("markdown data is empty")
	}

	md := goldmark.New(
		goldmark.WithExtensions(
			extension.GFM,
		),
		goldmark.WithParserOptions(
			parser.WithAutoHeadingID(),
		),
		goldmark.WithRendererOptions(
			html.WithHardWraps(),
			html.WithXHTML(),
		),
	)

	var buf strings.Builder
	if err := md.Convert(data, &buf); err != nil {
		return nil, fmt.Errorf("failed to parse markdown: %w", err)
	}

	htmlContent := buf.String()
	return splitIntoSections(htmlContent), nil
}

// splitIntoSections splits HTML content into sections based on headings.
// Each section starts with a heading and includes all content until the next heading.
func splitIntoSections(html string) []Section {
	var sections []Section
	var currentSection *Section
	var idCounter int64 = 1

	lines := strings.Split(html, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Check if line contains a heading tag (h1-h6)
		if strings.HasPrefix(line, "<h") && strings.Contains(line, ">") {
			// If we were building a section, add it to the list
			if currentSection != nil {
				currentSection.Content = strings.TrimSpace(currentSection.Content)
				sections = append(sections, *currentSection)
			}

			// Start new section
			currentSection = &Section{
				ID: idCounter,
			}
			idCounter++

			// Extract title from heading tag
			startIdx := strings.Index(line, ">") + 1
			endIdx := strings.LastIndex(line, "<")
			if startIdx > 0 && endIdx > startIdx {
				currentSection.Title = strings.TrimSpace(line[startIdx:endIdx])
			} else {
				currentSection.Title = fmt.Sprintf("Section %d", idCounter-1)
			}
		} else if currentSection != nil {
			// Add content to current section
			if currentSection.Content == "" {
				currentSection.Content = line
			} else {
				currentSection.Content = fmt.Sprintf("%s\n%s", currentSection.Content, line)
			}
		} else {
			// Content before first heading - create a default section
			currentSection = &Section{
				ID:    idCounter,
				Title: "Introduction",
			}
			idCounter++
			currentSection.Content = line
		}
	}

	// Add the last section if it exists
	if currentSection != nil && strings.TrimSpace(currentSection.Content) != "" {
		currentSection.Content = strings.TrimSpace(currentSection.Content)
		sections = append(sections, *currentSection)
	}

	return sections
}
