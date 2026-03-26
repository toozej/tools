# Lomography Homes Viewer

A Next.js application for browsing and viewing photos from Lomography user profiles.

## Features

- **Search & Discover**
  - Search by Lomography URL or username
  - **Random Artist** — jump to a random featured artist's page
  - **Featured Today** — deterministic daily artist pick (same artist for the same date)
  - Browse an artist's full album collection
- **Album Navigation**
  - Artist sub-page showing a grid of all albums with cover images
  - Click an album to view its photos with the same feed/grid views
- **View Modes**
  - Grid view for browsing photo thumbnails with lazy loading
  - Feed view — infinite-scrolling single-image layout with full-size photos
- **Sort Order** (on album detail page)
  - Latest (default, newest first)
  - Oldest (reversed order)
  - Shuffle (randomized order)
- **Lightbox** for individual photo inspection
- Lazy loading via IntersectionObserver — new batches are fetched as you scroll
- Automatic retries with exponential backoff for failed image loads and rate-limited pages

## Usage

1. Enter a Lomography URL (e.g., `https://www.lomography.com/homes/aciano/photos`) or just the username (e.g., `aciano`)
2. Or click **Random Artist** / **Featured Today** to discover artists
3. On an artist page, browse their albums or click **View All Photos**
4. Click an album to see its photos
5. Toggle between Grid and Feed view modes
6. On album pages, use the sort selector (Latest / Oldest / Shuffle)
7. Scroll down to automatically load more photos
8. Click any photo to open in a lightbox

## Architecture

### Why the Python scripts are needed

Lomography has no public API for fetching user photos. The only way to discover a user's photo URLs is to scrape their profile pages at `lomography.com/homes/{username}/photos`.

However, Lomography uses Cloudflare which blocks Node.js/Bun HTTP clients. The Python scripts use `aiohttp` which bypasses Cloudflare's detection, allowing them to fetch the profile pages and extract image URLs.

### How it works

1. The `/api/photos` route shells out to `scripts/fetch_photos.py` via `execFileSync`
2. The `/api/albums` route shells out to `scripts/fetch_albums.py`
3. The `/api/album-photos` route shells out to `scripts/fetch_album_photos.py`
4. The `/api/photo-detail` route shells out to `scripts/fetch_photo_detail.py`
5. The Python scripts fetch paginated pages from Lomography, extracting thumbnail URLs and links, returning them as JSON
6. The frontend receives the data and displays it in the appropriate view

```
Browser ──GET /api/photos?input=aciano&page=1──▶ Next.js server
                                                    │ execFileSync → Python
                                                    │ (grid pages only, fast)
                                                    ▼
                                              Returns {thumbnail, photoPage}[]
                                                    │
Browser ◀── JSON ─────────────────────────────────┘

For albums:
Browser ──GET /api/albums?input=aciano──▶ Next.js server
                                            │ execFileSync → Python
                                            ▼
                                      Returns {albums: [{albumId: "12345-slug", title, coverImage, ...}]}
                                            │
Browser ◀── JSON ─────────────────────────────┘

For album photos:
Browser ──GET /api/album-photos?input=aciano&albumId=12345-slug──▶ Next.js server
                                                                     │ execFileSync → Python
                                                                     ▼
                                                               Returns {images: [{thumbnail, photoPage: "/homes/.../albums/12345-slug/67890"}]}
                                                                     │
Browser ◀── JSON ──────────────────────────────────────────────────┘

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

The Python scrapers include several mechanisms to handle rate limiting:

- **Exponential backoff with jitter** on 429/5xx errors (up to 60s per retry, 7 retries per page)
- **Rate limiting** between outgoing requests (0.5s minimum gap)
- **Quick mode** (`--quick` flag) — skips inter-request delays and stops immediately on 404/end-of-album; used by all API routes to keep response times under 5s
- **End-of-album detection** — stops fetching when a page returns empty after images were already found
- **Tolerates empty batches** — stops only after 3 consecutive batches with no images
- **Extended timeout** — 300s total script timeout to accommodate slow responses

On the frontend, images that fail to load are automatically retried up to 3 times with increasing delays.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/lomo-homes-viewer/api/photos?input=<username>&page=<n>` | GET | Fetch a batch of thumbnail URLs with photo page links |
| `/lomo-homes-viewer/api/albums?input=<username>` | GET | Fetch all albums for a user |
| `/lomo-homes-viewer/api/album-photos?input=<username>&albumId=<id>&page=<n>&batchSize=<n>` | GET | Fetch photos from a specific album |
| `/lomo-homes-viewer/api/photo-detail?photoPage=<path>` | GET | Resolve a photo page (regular or album) to its full-size image URL |
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

**`/api/albums`**
```json
{
  "username": "aciano",
  "albumCount": 5,
  "albums": [
    { "albumId": "12345-summer-2024", "title": "Summer 2024", "coverImage": "https://cdn.assets.lomography.com/...?auth=...", "albumPage": "/homes/aciano/albums/12345-summer-2024" }
  ]
}
```

**`/api/album-photos`**
```json
{
  "username": "aciano",
  "albumId": "12345-summer-2024",
  "startPage": 1,
  "endPage": 8,
  "pagesScanned": 8,
  "imageCount": 30,
  "images": [
    { "thumbnail": "https://cdn.assets.lomography.com/.../172x256x1.jpg?auth=...", "photoPage": "/homes/aciano/albums/12345-summer-2024/29205949" }
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
Returns `{ "fullsize": null }` if the image cannot be resolved. Accepts both regular photo paths (`/homes/user/photos/123`) and album photo paths (`/homes/user/albums/123-slug/456`).

## Page Routes

| Route | Description |
|-------|-------------|
| `/lomo-homes-viewer/` | Home — search, random artist, featured today |
| `/lomo-homes-viewer/artist/[username]` | Artist page — album grid, view all photos |
| `/lomo-homes-viewer/artist/[username]/album/[albumId]` | Album detail — photos with sort & view mode |

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

The Dockerfile installs Python 3 and `aiohttp` in the runner stage for the scraper scripts.
