# Contact Sheet Creator

Create digital contact sheets from your photos like a traditional film contact sheet.

## Features

- Drag & drop images to create a contact sheet
- Choose between landscape (35mm style) or portrait (half-frame) orientation
- Customize rows, columns, and image dimensions
- Add header and footer text
- Optional film strip border with various film types (TMAX, HP5 PLUS, Portra, etc.)
- All processing happens in your browser - your images never leave your device

## Tech Stack

- Go + WebAssembly
- [bild](https://github.com/anthonynsimon/bild) for image processing
- [go-app](https://github.com/maxence-charriere/go-app) for the WebAssembly UI

## Development

```bash
GOOS=js GOARCH=wasm go build -o bin/web/app.wasm ./cmd/web/
```
