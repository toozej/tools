# Contact Sheet Creator

Create digital contact sheets from your photos like a traditional film contact sheet.

## Features

- Drag & drop images to create a contact sheet
- Choose between landscape (35mm style) or portrait (half-frame) orientation
- Set rows, columns, image dimensions, and overall sheet dimensions in pixels. Enter 0 for an automatically sized sheet.
- Add header and footer text to the exported image.
- Add a generated film border to each image based on its EXIF film type. Supported types include Kodak T-MAX 400 and Ilford HP5 Plus.
- Select one film type for every image, or turn off borders. Automatic mode leaves images without a supported EXIF film type plain.
- Fit the complete contact sheet inside custom dimensions without clipping images or text.
- All processing happens in your browser - your images never leave your device

## Tech Stack

- Go + WebAssembly
- [bild](https://github.com/anthonynsimon/bild) for image processing
- [go-app](https://github.com/maxence-charriere/go-app) for the WebAssembly UI

## Development

```bash
GOOS=js GOARCH=wasm go build -o bin/web/app.wasm ./cmd/web/
```
