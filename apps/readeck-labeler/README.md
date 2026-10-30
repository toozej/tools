# Readeck Labeler

Readeck Labeler finds bookmarks without labels in a Readeck instance. It sends each bookmark's saved article to an LLM and adds the generated labels to Readeck. The app runs as a Next.js server at `/readeck-labeler`.

## Description

Find unlabeled Readeck bookmarks and apply labels generated from their saved articles by an LLM.

## Setup

1. Copy `example.env` to `app.env`.
2. Set the values in `app.env`.
3. Run `bun install` and `bun dev` from this directory.
4. Open `http://localhost:3000/readeck-labeler`.

| Variable | Purpose |
| --- | --- |
| `READECK_URL` | Base URL of your Readeck instance. |
| `READECK_API_TOKEN` | Readeck API token with bookmark read and write access. |
| `LLM_API_URL` | Full OpenAI Chat Completions or Anthropic Messages endpoint URL. |
| `LLM_MODEL` | Model name, such as `gpt-4o`. |
| `LLM_API_TOKEN` | Token for the LLM endpoint. |

The server reads these values at request time. The form can override any value for one browser session. Leave a form field empty to use its environment value. The server does not send environment tokens to the browser. Docker Compose loads `app.env` when the file exists. You can use the form without that file.

For OpenAI, set `LLM_API_URL` to `https://api.openai.com/v1/chat/completions`. For Anthropic, set it to `https://api.anthropic.com/v1/messages`. The app sends article text to the configured LLM service. Protect this app with your normal access controls if you deploy it on a public host.

## Container

The runtime image starts the standalone Next.js server directly with Node.js.
The image removes npm and Corepack because the server does not need them.

## How it works

1. Enter your Readeck URL and API token. Enter the LLM API URL, model, and token. You can leave fields empty when you set environment values.
2. Select the maximum number of labels per bookmark from the 1–10 dropdown.
3. Click **Find Unlabeled Bookmarks**. The app requests all pages of bookmarks without labels from Readeck.
4. Review the found bookmarks.
5. Click **Generate and Apply Labels**. The app reads each saved article, requests labels from the LLM, and adds them to Readeck.
6. Watch progress after each bookmark. The results show applied labels and errors.

The app processes bookmarks one at a time. It does not apply labels when the LLM returns no valid labels. It checks each bookmark again before it applies labels. A bookmark that gained labels after the search appears as an error in the results.

## API endpoints

All paths start with `/readeck-labeler`.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Health check for Docker Compose. |
| `/api/bookmarks` | POST | Find bookmarks without labels. |
| `/api/process` | POST | Generate and apply labels to one bookmark. |

`POST /api/bookmarks` accepts optional `readeckUrl` and `readeckToken` fields. It returns `{ "bookmarks": [...], "count": 3 }`.

`POST /api/process` accepts `bookmarkId` and `maxLabels` from 1 to 10. It also accepts optional `readeckUrl`, `readeckToken`, `llmUrl`, `llmModel`, and `llmToken` fields. It returns the bookmark ID, title, applied labels, and `success: true`.

## Checks

Run `bun run typecheck`, `bun run lint`, `bun test`, and `bun run build` in this directory.
