# Active Context: Readeck Labeler

## Current state

Readeck Labeler runs as a Next.js server app at `/readeck-labeler`. It finds bookmarks without labels. It reads each saved article. It asks an LLM for labels and adds those labels to Readeck.

## Configuration

The server reads `READECK_URL`, `READECK_API_TOKEN`, `LLM_API_URL`, `LLM_MODEL`, and `LLM_API_TOKEN` from `.env.local` during local development. Docker Compose loads the file when it exists. The form can override each value for a request. The server keeps environment tokens out of browser responses.

The LLM endpoint accepts either OpenAI Chat Completions or Anthropic Messages format. The endpoint path selects the format. The app accepts 1–10 labels per bookmark.

## Workflow

1. `POST /api/bookmarks` requests Readeck bookmarks with `has_labels=false`, `limit`, and `offset`. It returns summaries for review.
2. `POST /api/process` accepts one bookmark ID and the label limit. It fetches current bookmark data and rejects bookmarks that already have labels.
3. The process route fetches the saved article as Markdown. It sends the article, title, URL, and description to the configured LLM.
4. The route validates generated labels. It updates Readeck with `add_labels`.
5. The browser makes one request per bookmark. It updates progress and results after each request.

## Container

The runtime image starts the standalone Next.js server directly with Node.js.
The image removes npm and Corepack because the server does not need them.

## Main files

| File | Purpose |
| --- | --- |
| `src/app/page.tsx` | Configuration, review, progress, and results UI. |
| `src/app/api/bookmarks/route.ts` | Bookmark search endpoint. |
| `src/app/api/process/route.ts` | Label generation and update endpoint. |
| `src/app/api/health/route.ts` | Runtime health check. |
| `src/lib/readeck.ts` | Readeck and LLM API calls. |
| `README.md` | Setup, usage, and API details. |
| `.env.local.example` | Environment template. |

## Verification

Run `bun run typecheck`, `bun run lint`, `bun test`, and `bun run build`. Validate Compose with its runtime and build profiles. The repository colophon includes this app.
