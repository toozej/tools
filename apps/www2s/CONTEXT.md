# Webpage Reader Aloud

This application allows users to input a URL and have the webpage read aloud using the browser's native text-to-speech system. If the native system is unavailable, it falls back to a configurable TTS API using Mozilla's Readability library for text extraction.

## Key Features

- URL input form
- Text extraction from webpages using Readability
- Native browser TTS support (SpeechSynthesis API)
- Fallback to configurable TTS API
- Responsive UI with Tailwind CSS
- Self-hostable in Docker with environment variables

## Architecture

- Frontend: Next.js with React 19, TypeScript, Tailwind CSS
- API Routes: Text extraction and TTS generation
- Dependencies: @mozilla/readability, jsdom

## Environment Variables

Configure TTS settings using these environment variables:

- `TTS_ENDPOINT`: URL of the TTS API (e.g., `https://api.openai.com/v1/audio/speech`)
- `TTS_TOKEN`: Authentication token for the TTS API
- `TTS_MODEL`: Model name for TTS (optional, depends on API provider)

## Self-Hosting with Docker

### Prerequisites
- Docker and Docker Compose installed
- Copy `app.env.example` to `app.env` and fill in your TTS configuration

### Quick Start
1. Clone the repository
2. Copy and configure environment variables:
   ```bash
   cp app.env.example app.env
   # Edit app.env with your TTS settings
   ```
3. Build and run with Docker Compose:
   ```bash
   docker-compose up --build
   ```
4. Access the application at `http://localhost`

### Manual Docker Commands
```bash
# Build the image
docker build -t webpage-reader .

# Run with environment file
docker run -p 3000:3000 --env-file app.env webpage-reader
```

### Docker Compose with Nginx
The included `docker-compose.yml` sets up:
- Next.js application on port 3000
- Nginx reverse proxy on port 80
- Environment variables loaded from `app.env`

## Dependabot Configuration

Automated dependency updates are configured via `.github/dependabot.yml`:
- **npm packages**: Weekly updates for `package.json`
- **Docker images**: Weekly updates for `Dockerfile` and `docker-compose.yml`

Dependabot will create pull requests for updates, which you can review and merge.

## Manual Package Updates

To manually update dependencies:

### Using Bun
```bash
# Check for outdated packages
bun outdated

# Update all packages
bun update

# Update specific package
bun update @mozilla/readability

# Reinstall lockfile
bun install --frozen-lockfile
```

### Verify Updates
```bash
# Run tests and checks
bun typecheck
bun lint
bun build
```

### Commit Updates
```bash
git add package.json bun.lock
git commit -m "Update dependencies"
git push
```

## Major Changes

- Initial implementation with native TTS and API fallback.