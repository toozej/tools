# XTeink Wallpaper Converter

Convert common image formats to BMP format suitable for XTeink X4 ereader wallpapers (uncompressed 24-bit color depth, 480x800 pixels).

## Features

- Convert single images or entire directories to BMP wallpaper format
- Automatic cropping to fit 480x800 resolution while maintaining aspect ratio
- Optional manual crop selection for precise control
- Directory uploads create a `sleep.zip` file with all converted wallpapers
- All processing happens in your browser - your images never leave your device

## Tech Stack

- Go + WebAssembly
- [bild](https://github.com/anthonynsimon/bild) for image processing
- [go-app](https://github.com/maxence-charriere/go-app) for the WebAssembly UI

## Development

```bash
GOOS=js GOARCH=wasm go build -o bin/web/app.wasm ./cmd/web/
```
