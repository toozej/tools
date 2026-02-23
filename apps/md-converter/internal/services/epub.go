package services

import (
	"archive/zip"
	"bytes"
	"fmt"
	"html"
	"regexp"
	"strings"
	"text/template"
	"time"
)

// DevicePreset holds e-ink device display settings.
type DevicePreset struct {
	Name     string
	Width    int
	Height   int
	FontSize int // in pt
	Margin   int // in px
}

// DevicePresets is the list of supported e-ink device targets.
var DevicePresets = []DevicePreset{
	{Name: "Xtreink X4", Width: 480, Height: 800, FontSize: 12, Margin: 16},
	{Name: "Onyx Boox Page", Width: 1264, Height: 1680, FontSize: 16, Margin: 24},
	{Name: "Kindle", Width: 1264, Height: 1680, FontSize: 16, Margin: 24},
	{Name: "Kobo Clara Reader", Width: 1072, Height: 1448, FontSize: 14, Margin: 20},
}

// GenerateEPUB produces an EPUB 3 file in memory containing one page per
// section. Returns the raw .epub bytes.
func GenerateEPUB(sections []Section, preset DevicePreset, title string) ([]byte, error) {
	if title == "" {
		title = "Markdown Document"
	}

	var buf bytes.Buffer
	w := zip.NewWriter(&buf)

	// 1. mimetype (must be the first file, uncompressed)
	if err := addUncompressed(w, "mimetype", "application/epub+zip"); err != nil {
		return nil, err
	}

	// 2. META-INF/container.xml
	if err := addFile(w, "META-INF/container.xml", containerXML()); err != nil {
		return nil, err
	}

	// 3. Styles
	css := generateCSS(preset)
	if err := addFile(w, "OEBPS/styles.css", css); err != nil {
		return nil, err
	}

	// 4. Section pages
	manifestItems := make([]string, 0, len(sections)+2)
	spineItems := make([]string, 0, len(sections)+1)

	// nav page is in spine first
	manifestItems = append(manifestItems,
		`<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
		`<item id="css" href="styles.css" media-type="text/css"/>`,
	)
	spineItems = append(spineItems, `<itemref idref="nav"/>`)

	for i, section := range sections {
		n := i + 1
		sectionID := fmt.Sprintf("section_%04d", n)
		sectionFile := fmt.Sprintf("OEBPS/%s.xhtml", sectionID)

		page, err := generateSectionPage(section.Title, section.Content, title)
		if err != nil {
			return nil, fmt.Errorf("section %d page: %w", n, err)
		}

		if err := addFile(w, sectionFile, page); err != nil {
			return nil, err
		}

		manifestItems = append(manifestItems,
			fmt.Sprintf(`<item id=%q href=%q media-type="application/xhtml+xml"/>`, sectionID, sectionID+".xhtml"),
		)
		spineItems = append(spineItems,
			fmt.Sprintf(`<itemref idref=%q/>`, sectionID),
		)
	}

	// 5. Navigation document
	nav := generateNav(sections, title)
	if err := addFile(w, "OEBPS/nav.xhtml", nav); err != nil {
		return nil, err
	}

	// 6. Package document (content.opf)
	opf := generateOPF(title, manifestItems, spineItems)
	if err := addFile(w, "OEBPS/content.opf", opf); err != nil {
		return nil, err
	}

	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("close epub zip: %w", err)
	}

	return buf.Bytes(), nil
}

// addUncompressed adds a file to the ZIP with Store (no compression).
// This is required for the EPUB mimetype entry.
func addUncompressed(w *zip.Writer, name, content string) error {
	header := &zip.FileHeader{
		Name:   name,
		Method: zip.Store,
	}
	f, err := w.CreateHeader(header)
	if err != nil {
		return fmt.Errorf("create %s: %w", name, err)
	}
	_, err = f.Write([]byte(content))
	return err
}

// addFile adds a file to the ZIP with default (Deflate) compression.
func addFile(w *zip.Writer, name, content string) error {
	f, err := w.Create(name)
	if err != nil {
		return fmt.Errorf("create %s: %w", name, err)
	}
	_, err = f.Write([]byte(content))
	return err
}

func containerXML() string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
}

func generateOPF(title string, manifestItems, spineItems []string) string {
	date := time.Now().UTC().Format("2006-01-02")
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>%s</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="uid">md-converter-%s</dc:identifier>
    <meta property="dcterms:modified">%sT00:00:00Z</meta>
  </metadata>
  <manifest>
    %s
  </manifest>
  <spine>
    %s
  </spine>
</package>`,
		html.EscapeString(title),
		date,
		date,
		strings.Join(manifestItems, "\n    "),
		strings.Join(spineItems, "\n    "),
	)
}

func generateNav(sections []Section, title string) string {
	var sb strings.Builder
	for i, section := range sections {
		n := i + 1
		sb.WriteString(fmt.Sprintf(`      <li><a href="section_%04d.xhtml">%s</a></li>`+"\n", n, html.EscapeString(section.Title)))
	}
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>%s</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>%s</h1>
    <ol>
%s    </ol>
  </nav>
</body>
</html>`,
		html.EscapeString(title),
		html.EscapeString(title),
		sb.String(),
	)
}

// sectionPageTmpl is the XHTML template for a single section page.
var sectionPageTmpl = template.Must(template.New("section").Parse(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>{{.Title}} — {{.BookTitle}}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <div class="page">
    <div class="section-title">{{.Title}}</div>
    <div class="section-content">{{.Content}}</div>
  </div>
</body>
</html>`))

type sectionPageData struct {
	Title     string
	BookTitle string
	Content   string // may contain HTML
}

func generateSectionPage(title string, content string, bookTitle string) (string, error) {
	// Strip or sanitize HTML tags to produce clean readable text.
	// We keep basic formatting but remove scripts/styles.
	safeContent := sanitizeHTML(content)

	var buf bytes.Buffer
	err := sectionPageTmpl.Execute(&buf, sectionPageData{
		Title:     title,
		BookTitle: bookTitle,
		Content:   safeContent,
	})
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}

// sanitizeHTML removes script/style tags and returns safe HTML suitable for
// embedding in XHTML. It preserves basic Markdown-generated HTML elements.
var (
	reScript = regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`)
	reStyle  = regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`)
)

func sanitizeHTML(raw string) string {
	s := reScript.ReplaceAllString(raw, "")
	s = reStyle.ReplaceAllString(s, "")
	// Preserve basic HTML elements generated by Markdown
	return s
}

func generateCSS(preset DevicePreset) string {
	return fmt.Sprintf(`/* md-converter — E-Ink Optimised Stylesheet */
/* Device: %s (%dx%d) */

body {
    margin: %dpx;
    padding: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: %dpt;
    color: #000000;
    background-color: #ffffff;
    line-height: 1.6;
}

.page {
    width: 100%%;
    min-height: 80vh;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    text-align: left;
    padding: %dpx;
}

.section-title {
    font-size: %dpt;
    font-weight: bold;
    color: #000000;
    border-bottom: 2px solid #000000;
    padding-bottom: 0.5em;
    margin-bottom: 1.5em;
    width: 100%%;
}

.section-content {
    font-size: %dpt;
    max-width: 100%%;
    line-height: 1.8;
}

.section-content p {
    margin: 0.5em 0;
}

.section-content h1, .section-content h2, .section-content h3, 
.section-content h4, .section-content h5, .section-content h6 {
    margin: 1em 0 0.5em 0;
    font-weight: bold;
}

.section-content h1 { font-size: 1.5em; }
.section-content h2 { font-size: 1.4em; }
.section-content h3 { font-size: 1.3em; }
.section-content h4 { font-size: 1.2em; }
.section-content h5 { font-size: 1.1em; }
.section-content h6 { font-size: 1.0em; }

.section-content ul, .section-content ol {
    margin: 0.5em 0;
    padding-left: 2em;
}

.section-content code {
    font-family: monospace;
    background-color: #f0f0f0;
    padding: 0.1em 0.3em;
    border-radius: 3px;
}

.section-content pre {
    background-color: #f0f0f0;
    padding: 1em;
    border-radius: 5px;
    overflow-x: auto;
    margin: 0.5em 0;
}

.section-content pre code {
    background-color: transparent;
    padding: 0;
}

.section-content blockquote {
    border-left: 3px solid #ccc;
    padding-left: 1em;
    margin: 0.5em 0;
    font-style: italic;
}

.section-content table {
    border-collapse: collapse;
    width: 100%%;
    margin: 0.5em 0;
}

.section-content th, .section-content td {
    border: 1px solid #ccc;
    padding: 0.5em;
    text-align: left;
}

.section-content th {
    background-color: #f0f0f0;
    font-weight: bold;
}
`,
		preset.Name, preset.Width, preset.Height,
		preset.Margin,
		preset.FontSize,
		preset.Margin*2,
		preset.FontSize+4,
		preset.FontSize,
	)
}
