# JSON Utils

A modern, responsive web application that combines multiple JSON utilities into one convenient tool. Format, validate, convert to YAML, compare JSON documents, and fix incomplete JSON data.

## Features

### 📝 Format & Validate JSON
- Auto-format JSON with customizable indentation (2 or 4 spaces)
- Real-time validation with error messages
- Instant feedback on JSON validity

### 🔄 JSON to YAML Converter
- Convert JSON to YAML with three output styles:
  - **Block Style**: Standard YAML format with proper indentation
  - **Flow Style**: Compact single-line format
  - **Quoted Strings**: All strings are double-quoted

### 🔍 JSON Diff
- Compare two JSON documents side-by-side
- See detailed differences with path information
- Shows added, removed, and modified values
- Swap inputs with one click

### 🔧 Incomplete JSON Printer
- Format truncated or incomplete JSON data
- Useful for debugging partial JSON responses
- Handles unclosed brackets and strings

### 🚀 Auto-Detect Mode
- Automatically detects the appropriate tool based on input:
  - Valid JSON → Format mode
  - Two JSON inputs → Diff mode
  - Incomplete JSON → Incomplete JSON printer

## Usage

1. **Open the application** in your browser
2. **Paste your JSON** in the left input panel
3. **Select a mode** from the toolbar, or let Auto-Detect choose for you
4. **View the output** in the right panel
5. **Copy the result** using the Copy button

### Mode Selection

- **Auto Detect**: Automatically chooses the best mode based on your input
- **Format JSON**: Validates and formats JSON with proper indentation
- **JSON → YAML**: Converts JSON to YAML format
- **JSON Diff**: Compare two JSON documents (use both input panels)
- **Incomplete JSON**: Format incomplete or truncated JSON

### Examples

Click the example buttons to load sample data:
- **Load JSON Example**: Shows a sample JSON object
- **Load Diff Example**: Shows two JSON objects for comparison
- **Load Incomplete Example**: Shows truncated JSON for the incomplete printer

## Installation

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 20+
- Git

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd json-utils

# Install dependencies
bun install

# Start development server
bun dev
```

The application will be available at `http://localhost:3000`.

### Build for Production

```bash
# Create production build
bun build

# Start production server
bun start
```

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| [Next.js](https://nextjs.org/) | 16.x | React framework with App Router |
| [React](https://react.dev/) | 19.x | UI library |
| [TypeScript](https://www.typescriptlang.org/) | 5.9.x | Type-safe JavaScript |
| [Tailwind CSS](https://tailwindcss.com/) | 4.x | Utility-first CSS framework |
| [js-yaml](https://github.com/nodeca/js-yaml) | 4.1.x | YAML parser and dumper |
| [Bun](https://bun.sh/) | Latest | Package manager & runtime |

### Project Structure

```
json-utils/
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout with metadata
│   │   ├── page.tsx        # Main page component
│   │   └── globals.css     # Global styles
│   └── components/
│       └── JsonUtils.tsx   # Main JSON utilities component
├── public/                  # Static assets
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── tailwind.config.ts      # Tailwind CSS configuration
└── README.md               # This file
```

### Key Features Implementation

- **Auto-save**: Input is automatically saved to localStorage
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Mode Support**: Respects system dark mode preferences
- **Zero Dependencies on Server**: All processing happens client-side

## Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start development server |
| `bun build` | Build for production |
| `bun start` | Start production server |
| `bun lint` | Run ESLint |
| `bun typecheck` | Run TypeScript type checking |

## Browser Support

- Modern browsers (ES2020+)
- Chrome, Firefox, Safari, Edge (latest versions)
- No Internet Explorer support
