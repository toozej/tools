# Bingo Creator

A progressive web app (PWA) for creating custom bingo cards, built with Go + WebAssembly using [go-app](https://github.com/maxence-charriere/go-app).

## Features

- **Custom Bingo Cards**: Create bingo cards for trips, events, or any occasion
- **Adjustable Grid Size**: Choose from 3x3 to 10x10 grids
- **PDF Export**: Download your bingo cards as PDF files
- **Batch PDF Export**: Generate and download up to 50 numbered cards from the current tile list
- **Tile Pools**: Save reusable tile lists, import `.txt` pools, and download them for sharing
- **Tablet Play Mode**: Tap tiles to mark a card, then export the marked-up card as a PDF
- **Local Storage**: Your items are saved automatically per trip name
- **Shuffled Generation**: Each card gets a unique arrangement
- **Free Space**: Center cell is automatically set as "Free Space"
- **Offline Support**: Works offline once loaded (PWA)
- **Responsive Design**: Works on desktop and mobile devices

## Quick Start

### Prerequisites

- Go 1.27.1
- Docker (for containerized deployment)

### Local Development

1. **Navigate to the app directory**:
   ```bash
   cd apps/bingo-creator
   ```

2. **Install dependencies**:
   ```bash
   go mod download
   ```

3. **Build the WASM binary**:
   ```bash
   rm -rf ./bin/*
   GOOS=js GOARCH=wasm go build -o bin/web/app.wasm -ldflags="-s -w" ./cmd/web/;
   go build -o bin/generate -ldflags="-s -w" ./cmd/web/ && cd bin/ && ./generate && rm -f ./generate && cd ../;
   cp -r static bin/;
   ```

4. **Run with a local web server**:
   
   The app expects to be served at the `/bingo-creator/` path (matching production nginx config).
   
   **Option A: Using npx serve with path prefix (recommended)**
   ```bash
   # Create a parent directory structure to match /bingo-creator/ path
   rm -rf ~/tmp/bingo-server/bingo-creator/*
   mkdir -p ~/tmp/bingo-server/bingo-creator
   cp -r bin/* ~/tmp/bingo-server/bingo-creator/
   npx serve ~/tmp/bingo-server -p 8081
   ```
   Then open `http://localhost:8081/bingo-creator/`
   
   **Option B: Using Go's http server with path prefix (best for WASM MIME type)**
   ```bash
   # Run from apps/bingo-creator directory
   cat > /tmp/serve.go << 'EOF'
   package main

   import (
       "net/http"
       "strings"
   )

   func main() {
       fs := http.FileServer(http.Dir("static"))
       http.HandleFunc("/bingo-creator/", func(w http.ResponseWriter, r *http.Request) {
           // Strip the /bingo-creator prefix
           r.URL.Path = strings.TrimPrefix(r.URL.Path, "/bingo-creator/")
           if r.URL.Path == "" {
               r.URL.Path = "/"
           }
           // Set WASM MIME type
           if strings.HasSuffix(r.URL.Path, ".wasm") {
               w.Header().Set("Content-Type", "application/wasm")
           }
           fs.ServeHTTP(w, r)
       })
       // Redirect root to /bingo-creator/
       http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
           if r.URL.Path == "/" {
               http.Redirect(w, r, "/bingo-creator/", http.StatusFound)
               return
           }
           http.NotFound(w, r)
       })
       println("Server running at http://localhost:8081/bingo-creator/")
       http.ListenAndServe(":8081", nil)
   }
   EOF
   go run /tmp/serve.go
   ```
   Then open `http://localhost:8081/bingo-creator/`

5. **Open in browser**:
   - For Options A & B: `http://localhost:8081/bingo-creator/`

6. **Debug in browser**:
   - Open Developer Tools (F12 or Cmd+Option+I)
   - Check the Console tab for any errors
   - Check the Network tab to verify `app.wasm` loads with status 200 and Content-Type `application/wasm`

### Docker Deployment

```bash
# Build the image
docker build -t bingo-creator .

# Run the container
docker run -p 8080:8080 bingo-creator
```

Access the app at `http://localhost:8080`

## Usage

1. **Enter Trip Name**: Give your bingo card a name (used for localStorage key and filename)
2. **Select Grid Size**: Choose from 3x3 to 10x10 (default is 5x5)
3. **Enter Items**: Add your bingo items, one per line in the text area
4. **Generate Card**: Click "Generate New Card" to create the bingo grid
5. **Export PDF**: Click "Export PDF" to download your bingo card as a PDF file

### Tile Pools, Tablet Play, and Batch Export

- Save the current newline-delimited list with a pool name, or upload a `.txt` file containing one tile per line. Saved pools are persisted in this browser and restored when the app reloads; use **Download pool** to keep a portable file copy.
- Enable **Tablet play mode** after creating a card to tap tiles on an iPad or tablet. The free-space tile starts marked, and **Export Card PDF** includes every mark.
- Set **Cards to export** and select **Export X PDFs** to create independently shuffled cards named `bingo_card_<trip>_1.pdf`, `bingo_card_<trip>_2.pdf`, and so on. Browsers may ask for permission to download multiple files.

### Item Guidelines

- Enter one item per line
- Items are automatically trimmed (whitespace removed)
- Empty lines are skipped
- If you have fewer items than grid cells, "EMPTY" is used for remaining cells
- The center cell is always "Free Space"

### Example Items

```
See a highland cow
Drink scotch
Train is late
Sunday roast 
Fish and chips
```

## Architecture

```
apps/bingo-creator/
├── cmd/web/              # Go entrypoint
│   └── main.go
├── internal/
│   ├── app/              # App wrapper
│   ├── components/       # UI components (go-app)
│   └── services/         # Business logic
│       ├── generator.go  # Bingo card generation
│       └── storage.go    # localStorage wrapper
├── static/               # Static assets
│   ├── index.html        # HTML entrypoint
│   ├── app.css          # Styles
│   ├── app.wasm         # Compiled WASM binary
│   ├── manifest.json    # PWA manifest
│   └── sw.js            # Service worker
├── Dockerfile           # Docker build
├── nginx.conf           # Nginx configuration
└── go.mod              # Go module
```

## Additional Commands

```bash
# Run tests (if any)
go test ./...

# Lint
go vet ./...
```

## Troubleshooting

### Common Issues

**1. Blank page or `<div class="goapp-app-info">` visible but no content**
- The WASM is loading but the app isn't rendering
- Check browser console for JavaScript errors
- Verify the `app.wasm` file exists in the static directory
- Ensure you're using the correct `wasm_exec.js` for your Go version

**2. "Failed to load WebAssembly" error**
- Check that `app.wasm` is being served with `Content-Type: application/wasm`
- Use the Network tab in DevTools to verify the response headers
- Try using the Go server option (Option C) which sets the correct MIME type

**3. WASM file returns 200 but doesn't execute**
- The file might be returning `index.html` due to SPA routing
- Ensure your server is configured to serve `.wasm` files correctly
- Check the response content in Network tab - it should be binary, not HTML

**4. Changes not reflected after rebuild**
- Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)
- Service worker may be caching old files - clear in DevTools > Application > Service Workers

### Debug Mode

To enable verbose logging in the WASM app, add console logging:
```go
func (h *home) OnMount(ctx app.Context) {
    app.Log("home component mounted")
    // ... rest of initialization
}
```

## Environment Variables

No environment variables are required. The app is fully self-contained.

## Browser Support

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires WebAssembly support.
