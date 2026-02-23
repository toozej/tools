# md-converter

A modern, responsive web application that converts Markdown files (.md files) to either EPUB files optimized for a variety of popular e-ink devices, or XTC files for XTEINK devices. Perfect for reading Markdown documents on your Kindle, Kobo, Onyx Boox, or other e-readers in a clean, optimized format.

## Features

- **📁 Multiple Input Methods**
  - Upload `.md` files via drag-and-drop or file browser
  - Load Markdown files from a direct URL

- **📱 E-Ink Device Presets** - Optimized formatting for popular e-ink devices:
  - **Xteink X4** (480×800) - Compact layout with smaller fonts
  - **Onyx Boox Page** (1264×1680) - High-resolution optimized
  - **Kindle** (1264×1680) - Kindle-specific formatting
  - **Kobo Clara Reader** (1072×1448) - Kobo-optimized settings

- **📖 Clean Reading Format**
  - Sections based on Markdown headings
  - Supports GitHub Flavored Markdown (GFM) features:
    - Tables
    - Task lists
    - Strikethrough
    - Code blocks
    - Blockquotes
    - And more

- **🎨 E-Ink Optimized Styling**
  - High contrast black & white design
  - Readable serif fonts (Georgia)
  - Proper margins for comfortable reading
  - Clean, distraction-free layout
  - Support for Markdown-formatted content (headings, lists, code, etc.)

- **⚡ Fast & Private**
  - Client-side processing - your Markdown files never leave your browser
  - No account required
  - Instant conversion and download

## Usage

### Quick Start

1. **Open** md-converter in your browser
2. **Choose** your input method:
   - Click to upload or drag & drop an `.md` file, OR
   - Enter a direct URL to an `.md` file
3. **Select** your e-ink device from the dropdown
4. **Click** "Convert & Download EPUB"
5. **Transfer** the EPUB to your e-reader and start reading!

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Go](https://go.dev/) | Backend and Wasm conversion logic |
| [WebAssembly (Wasm)](https://webassembly.org/) | Client-side document processing |
| [Goldmark](https://github.com/yuin/goldmark) | Markdown parsing with GFM support |
| [HTML5](https://developer.mozilla.org/en-US/docs/Web/HTML) | User interface |
| [CSS3](https://developer.mozilla.org/en-US/docs/Web/CSS) | Styling and responsive design |
| [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) | Browser interaction and Wasm integration |
| [Docker](https://www.docker.com/) | Containerization and deployment |
| [nginx](https://nginx.org/) | Reverse proxy and static file serving |

## Installation

### Prerequisites

- [Go](https://go.dev/) 1.21+ installed on your system
- [Docker](https://www.docker.com/) (optional, for containerized development)

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd md-converter

# Install Go dependencies
go mod download
```

## Development

### Option 1: Local Development

```bash
# Build the application
make build

# Start the development server
make run
```

The application will be available at `http://localhost:8080`.

### Option 2: Docker Development

```bash
# Build and run with Docker
docker build -t md-converter .
docker run -p 8080:80 md-converter
```

## Production

### Docker Deployment

```bash
# Build production image
docker build -t md-converter:prod .

# Run production container
docker run -d -p 80:80 --name md-converter md-converter:prod
```

## Code Quality

```bash
# Run tests
go test ./internal/... -v

# Go fmt
go fmt ./...
```

## How It Works

1. **Markdown Parsing**: Reads and parses Markdown content using Goldmark with GitHub Flavored Markdown support
2. **Section Extraction**: Splits content into sections based on Markdown headings
3. **EPUB Generation**: Creates an EPUB 3.0 file with one chapter per section using Go's xml and archive/zip packages
4. **E-Ink Optimization**: Applies device-specific CSS for optimal readability on e-ink displays
5. **Download**: Generated EPUB downloads directly to your device

All processing happens in your browser using WebAssembly (Wasm), ensuring your Markdown files never leave your device.

## Application Structure

```
md-converter/
├── cmd/
│   └── web/
│       └── main.go                 # Main entry point for Wasm compilation and static site generation
├── internal/
│   └── services/
│       ├── md.go                   # Markdown parser with GFM support
│       ├── epub.go                 # EPUB generation
│       ├── converter.go            # Conversion orchestration
│       └── *.test.go               # Tests
├── bin/                            # Generated static site files
├── static/                         # Static assets (CSS, JavaScript, icons)
├── Dockerfile                      # Build container
├── Dockerfile.serve               # Production serving container with nginx
├── nginx.conf                      # nginx configuration
└── Makefile                        # Build automation
```

## EPUB Structure

```
📖 Your Document.epub
├── Introduction                     # Content before first heading
├── Section 1                        # Based on # Heading
├── Section 2                        # Based on # Heading
└── ...
```

## Supported File Formats

| Format | Support |
|--------|---------|
| `.md` (Markdown) | ✅ Input |
| `.epub` (EPUB 3.0) | ✅ Output |
| `.xtc` (XTC) | ✅ Output (1-bit monochrome) |
| `.xtch` (XTCH) | ✅ Output (2-bit grayscale) |

## Credits

See [CREDITS.md](./CREDITS.md) for attribution and inspiration.
