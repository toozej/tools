# anki2epub

A modern, responsive web application that converts Anki flashcard decks (.apkg files) to EPUB files optimized for e-ink devices. Perfect for studying on your Kindle, Kobo, Onyx Boox, or other e-readers when the Anki app isn't available.

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

1. **Open** anki2epub in your browser
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
| [Next.js 16](https://nextjs.org/) | React framework with App Router |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe JavaScript |
| [Tailwind CSS 4](https://tailwindcss.com/) | Utility-first styling |
| [Bun](https://bun.sh/) | Package manager & runtime |
| [JSZip](https://stuk.github.io/jszip/) | ZIP file handling (APKG & EPUB) |
| [sql.js](https://sql.js.org/) | SQLite database parsing in browser |

## Installation

### Prerequisites

- [Bun](https://bun.sh/) installed on your system
- Node.js 20+ (for compatibility)

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd anki2epub

# Install dependencies
bun install
```

## Development

```bash
# Start development server
bun dev
```

The application will be available at `http://localhost:3000`.

## Production

```bash
# Build for production
bun build

# Start production server
bun start
```

## Code Quality

```bash
# TypeScript type checking
bun typecheck

# ESLint
bun lint
```

## How It Works

1. **Anki Deck Parsing**: Extracts the SQLite database from the `.apkg` file (a ZIP archive) and reads flashcard data using sql.js
2. **Content Cleaning**: Sanitizes HTML content to remove scripts and styles while preserving useful formatting
3. **EPUB Generation**: Creates an EPUB 3.0 file with two chapters per flashcard (question + answer) using JSZip
4. **E-Ink Optimization**: Applies device-specific CSS for optimal readability on e-ink displays
5. **Download**: Generated EPUB downloads directly to your device

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
