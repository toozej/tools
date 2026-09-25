# Photos Viewer

## Overview

Browse public photos from Lomography Homes, Reddit communities, Flickr, and Imgur. Use a thumbnail grid or scrolling feed. View and download full size images.

The viewer saves recent result pages in browser storage for ten minutes. Images use a blurred loading state and retry failed requests.

## Use

1. Open `/photos-viewer` and select a source.
2. Enter a Lomography artist, a subreddit, or a search phrase.
3. Select **Load Photos**. Scroll to load more results.
4. Select **Grid** or **Feed**. Select an image for the full screen view.
5. Select **Download full size** after the full size image loads.

Lomography also has **Random Artist**, **Featured Today**, and **View Albums** actions. Artist and album pages retain their previous URLs under the new `/photos-viewer` base path. Reddit has quick buttons for `r/analog`, `r/photography`, and `r/filmphotography`. The subreddit field accepts other public subreddit names.

nginx redirects old `/lomo-homes-viewer` links to `/photos-viewer` and preserves their query strings.

The **Refresh** button clears saved pages for the current source and query. The browser keeps other saved pages until they expire. Browsers can disable local storage; the feed still works in that case.

## Source access

| Source | Server setting | Search and pagination |
| --- | --- | --- |
| Lomography | `FLARESOLVERR_URL` when Cloudflare requires a challenge | Artist photos and albums; page ranges |
| Reddit | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` | New posts in a public subreddit; listing cursor |
| Flickr | `FLICKR_API_KEY` | Public photo search; numbered pages |
| Imgur | `IMGUR_CLIENT_ID` | Public gallery search; numbered pages |

Keep credentials on the server. Do not expose them through `NEXT_PUBLIC_` settings. Reddit access uses an application OAuth token and a user agent that identifies this app. Reddit requires explicit approval for Data API access. Flickr and Imgur require registered application credentials. Missing settings produce a clear error in the viewer.

Follow the [API credential setup guide](docs/api-credentials.md) to request access and install the settings.

The app requests only public photos. Reddit skips NSFW posts, videos, and posts without a direct image or gallery image. Imgur skips NSFW items and GIFs. Flickr uses safe search. Source services can limit requests or change their APIs.

Source documentation: [Reddit listings](https://www.reddit.com/dev/api/), [Reddit Data API terms](https://redditinc.com/policies/data-api-terms), [Flickr API](https://www.flickr.com/services/api/flickr.photos.search.html), [Imgur gallery search](https://api.imgur.com/endpoints/gallery), [Imgur client ID](https://api.imgur.com/oauth2).

## API

`GET /photos-viewer/api/photos?source=<source>&input=<query>&cursor=<cursor>` returns `{ images, nextCursor, hasMore, imageCount }`. `source` is `lomography`, `reddit`, `flickr`, or `imgur`. Omit `cursor` for the first page. Lomography also accepts its prior `page` and `batchSize` parameters.

Each image has `thumbnail`, `photoPage`, and, when the source provides it, `fullsize`. The Lomography script resolves full size images on demand through `GET /photos-viewer/api/photo-detail?photoPage=<path>`. The full size download endpoint is `GET /photos-viewer/api/download?url=<image-url>` and accepts known image hosts only.

Lomography album endpoints remain available:

- `GET /photos-viewer/api/albums?input=<artist>`
- `GET /photos-viewer/api/album-photos?input=<artist>&albumId=<id>&page=<n>&batchSize=<n>`
- `GET /photos-viewer/api/health`

## Lomography scraper

Lomography has no public photo API. Python scripts in `scripts/` scrape public Homes pages. The Compose stack runs a private FlareSolverr sidecar for Cloudflare challenges. The shared client reuses a browser session and serializes navigation with a process lock. The scripts return image URLs without changing Lomography's path bound CDN tokens. A failed challenge returns an error instead of an empty feed.

The scraper accepts `FLARESOLVERR_URL`, `FLARESOLVERR_SESSION`, `FLARESOLVERR_TIMEOUT_SECONDS`, and `FLARESOLVERR_SESSION_TTL_MINUTES`. The default session name is `photos-viewer`.

## Development

```bash
cd apps/photos-viewer
bun install
bun run dev
bun run test
bun run typecheck
```

`bun run test` runs once. Use `bun run test:watch` to rerun tests after file changes.

The Docker image includes Python 3 for the Lomography scripts. The app is a Next.js server behind nginx. Compose reads the old `apps/lomo-homes-viewer/app.env` file when it exists. It also reads `apps/photos-viewer/app.env`, which takes precedence. Both files are optional. Set source credentials in the service environment or the new env file. Never commit either file.
