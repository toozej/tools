# Lomography Homes Viewer

A Next.js application for browsing and viewing photos from Lomography user profiles.

## Features

- Search by Lomography URL or username
- Grid view for browsing photo thumbnails with lazy loading
- Feed view — infinite-scrolling single-image layout with full-size photos
- Lightbox for individual photo inspection
- Lazy loading via IntersectionObserver — new batches are fetched as you scroll
- Automatic retries with exponential backoff for failed image loads and rate-limited pages

## Usage

1. Enter a Lomography URL (e.g., `https://www.lomography.com/homes/aciano/photos`) or just the username (e.g., `aciano`)
2. Click "Load Photos" to start fetching photos
3. Scroll down to automatically load more photos
4. Toggle between Grid and Feed view modes
5. Click any photo to open in a lightbox

## Architecture

### Why the Python script is needed

Lomography has no public API for fetching user photos. The only way to discover a user's photo URLs is to scrape their profile pages at `lomography.com/homes/{username}/photos`.

However, Lomography uses Cloudflare which blocks Node.js/Bun HTTP clients. The Python script (`scripts/fetch_photos.py`) uses `aiohttp` which bypasses Cloudflare's detection, allowing it to fetch the profile pages and extract image URLs.

### How it works

1. The `/api/photos` route shells out to `scripts/fetch_photos.py` via `execFileSync`
2. The Python script fetches paginated grid pages from Lomography, extracting thumbnail URLs and photo page links, and returns them as JSON
3. The frontend receives `{thumbnail, photoPage}` pairs
4. **Grid view** loads thumbnail images directly from the CDN
5. **Feed view** shows thumbnails initially, then resolves full-size URLs on demand via `/api/photo-detail` as images scroll into view
6. **Lightbox** also resolves full-size URLs on demand

```
Browser ──GET /api/photos?input=aciano&page=1──▶ Next.js server
                                                    │ execFileSync → Python
                                                    │ (grid pages only, fast)
                                                    ▼
                                              Returns {thumbnail, photoPage}[]
                                                    │
Browser ◀── JSON ─────────────────────────────────┘

For feed view / lightbox (on demand):
Browser ──GET /api/photo-detail?photoPage=/homes/...──▶ Next.js server
                                                          │ execFileSync → Python
                                                          │ (single detail page)
                                                          ▼
                                                    Returns {fullsize: url}
                                                          │
Browser ◀── JSON ───────────────────────────────────────┘

For displaying images:
Browser ──GET cdn.assets.lomography.com/...──▶ Lomography CDN
                                            │
Browser ◀── image bytes ──────────────────┘
```

### Important: CDN URL auth tokens

Image URLs from the Lomography CDN include an `?auth=` token that is **bound to the specific file path** (including the resolution dimensions). Modifying the path (e.g., changing the resolution) invalidates the token and causes HTTP 405 errors. The scraper returns URLs exactly as they appear in the HTML to preserve valid tokens.

### Rate limiting and retries

The Python scraper includes several mechanisms to handle rate limiting:

- **Exponential backoff with jitter** on 429/5xx errors (up to 60s per retry, 7 retries per page)
- **Rate limiting** between outgoing requests (0.5s minimum gap)
- **Tolerates empty batches** — stops only after 3 consecutive batches with no images
- **Extended timeout** — 300s total script timeout to accommodate slow responses

On the frontend, images that fail to load are automatically retried up to 3 times with increasing delays.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/lomo-homes-viewer/api/photos?input=<username>&page=<n>` | GET | Fetch a batch of thumbnail URLs with photo page links |
| `/lomo-homes-viewer/api/photo-detail?photoPage=<path>` | GET | Resolve a photo page to its full-size image URL |
| `/lomo-homes-viewer/api/health` | GET | Health check endpoint |

### Response format

**`/api/photos`**
```json
{
  "username": "aciano",
  "startPage": 1,
  "endPage": 8,
  "pagesScanned": 8,
  "imageCount": 50,
  "images": [
    { "thumbnail": "https://cdn.assets.lomography.com/.../172x256x1.jpg?auth=...", "photoPage": "/homes/aciano/photos/29205949" }
  ],
  "hasMore": true
}
```

**`/api/photo-detail`**
```json
{
  "fullsize": "https://cdn.assets.lomography.com/.../1216x1812x1.jpg?auth=..."
}
```

## Environment Variables

No environment variables are required. The app fetches directly from `lomography.com`.

## Development

```bash
bun install
bun run dev
```

## Docker

This is a runtime app served via nginx reverse proxy. Build and deploy with:

```bash
make dev
```

The Dockerfile installs Python 3 and `aiohttp` in the runner stage for the scraper script.
