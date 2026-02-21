# anki-converter

A modern, responsive web application that converts Anki flashcard decks (.apkg files) to either EPUB files optimized for a variety of popular e-ink devices, or XTC files for XTEINK devices. Perfect for studying on your Kindle, Kobo, Onyx Boox, or other e-readers when the Anki app isn't available.

## Features

- **📁 Multiple Input Methods**
  - Upload `.apkg` files via drag-and-drop or file browser
  - Load decks from a direct URL

- **📱 E-Ink Device Presets** - Optimized formatting for popular e-ink devices:
  - **Xteink X4** (480×800) - Compact layout with smaller fonts
  - **Onyx Boox Page** (1264×1680) - High-resolution optimized
  - **Kindle** (1264×1680) - Kindle-specific formatting
  - **Kobo Clara Reader** (1072×1448) - Kobo-optimized settings

- **📖 Two-Page Flashcard Format**
  - Each flashcard generates two pages for easy self-testing:
    - **Question #** - The front of the card
    - **Answer #** - The back of the card
  - Navigate to the next page to reveal the answer

- **🎨 E-Ink Optimized Styling**
  - High contrast black & white design
  - Readable serif fonts (Georgia)
  - Proper margins for comfortable reading
  - Clean, distraction-free layout

- **⚡ Fast & Private**
  - Client-side processing - your decks never leave your browser
  - No account required
  - Instant conversion and download

## Usage

### Quick Start

1. **Open** anki-converter in your browser
2. **Choose** your input method:
   - Click to upload or drag & drop an `.apkg` file, OR
   - Enter a direct URL to an `.apkg` file
3. **Select** your e-ink device from the dropdown
4. **Click** "Convert & Download EPUB"
5. **Transfer** the EPUB to your e-reader and start studying!

### Tips for E-Reader Studying

- Use your e-reader's navigation to go from Question → Answer
- The two-page format lets you test yourself before seeing the answer
- Adjust your device's font settings if needed for personal preference

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Go](https://go.dev/) | Backend and Wasm conversion logic |
| [WebAssembly (Wasm)](https://webassembly.org/) | Client-side deck processing |
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
cd anki-converter

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
docker build -t anki-converter .
docker run -p 8080:80 anki-converter
```

## Production

### Docker Deployment

```bash
# Build production image
docker build -t anki-converter:prod .

# Run production container
docker run -d -p 80:80 --name anki-converter anki-converter:prod
```

## Code Quality

```bash
# Run tests
go test ./internal/... -v

# Go fmt
go fmt ./...
```

## How It Works

1. **Anki Deck Parsing**: Extracts the SQLite database from the `.apkg` file (a ZIP archive) and reads flashcard data using Go's built-in archive/zip and database/sql packages
2. **Content Cleaning**: Sanitizes HTML content to remove scripts and styles while preserving useful formatting
3. **EPUB Generation**: Creates an EPUB 3.0 file with two chapters per flashcard (question + answer) using Go's xml and archive/zip packages
4. **E-Ink Optimization**: Applies device-specific CSS for optimal readability on e-ink displays
5. **Download**: Generated EPUB downloads directly to your device

All processing happens in your browser using WebAssembly (Wasm), ensuring your decks never leave your device.

## Application Structure

```
anki-converter/
├── cmd/
│   └── web/
│       └── main.go                 # Main entry point for Wasm compilation and static site generation
├── internal/
│   ├── services/
│   │   ├── apkg.go                # Anki .apkg file parser
│   │   ├── epub.go                # EPUB generation
│   │   ├── converter.go           # Card conversion and sanitization
│   │   └── *.test.go              # Tests
│   └── sqlite3/
│       └── sqlite3.go             # Pure-Go SQLite3 database reader
├── bin/                            # Generated static site files
├── static/                         # Static assets (CSS, JavaScript, icons)
├── Dockerfile                      # Build container
├── Dockerfile.serve               # Production serving container with nginx
├── nginx.conf                      # nginx configuration
└── Makefile                        # Build automation
```

## EPUB Structure

```
📖 Your Deck Name.epub
├── Introduction - Deck info and usage tips
├── Question 1 → Answer 1
├── Question 2 → Answer 2
├── Question 3 → Answer 3
└── ...
```

Each flashcard takes two pages:
- **Question #** - Front of card (test yourself!)
- **Answer #** - Back of card (check your knowledge)

## Supported File Formats

| Format | Support |
|--------|---------|
| `.apkg` (Anki Package) | ✅ Input |
| `.epub` (EPUB 3.0) | ✅ Output |

## Credits

See [CREDITS.md](./CREDITS.md) for attribution and inspiration.
