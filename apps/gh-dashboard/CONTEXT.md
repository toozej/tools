# GitHub Repo Status Dashboard

## Project Purpose

A modern, responsive web dashboard for monitoring GitHub repository status. This application provides a comprehensive view of a user's repositories including build status, workflow runs, releases, and commit history.

## Key Features

- **Repository Overview**: Tabular view of all user repositories sorted by most recently modified
- **Build Status Monitoring**: Visual indicators showing passing (green), failing (red), running (yellow), or unknown build status
- **Actions History**: Display of recent workflow runs with clickable links to GitHub Actions
- **Release Tracking**: Most recent release version for each repository
- **Commit History**: Latest commit hash and message
- **Filters & Search**: Filter repositories by name, description, language, and build status
- **Live Refresh**: Auto-refreshes every 30 seconds with a manual force refresh button
- **Rate Limit Awareness**: Shows remaining API requests and handles rate limiting gracefully
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Dark Mode Support**: Automatic dark mode based on system preferences

## Architecture

### Technology Stack

- **Framework**: Next.js 15 with React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Package Manager**: Bun
- **Containerization**: Docker with optional Nginx reverse proxy

### Project Structure

```
src/
├── app/
│   ├── api/repos/route.ts    # API route for fetching repo data
│   ├── globals.css           # Tailwind CSS import
│   ├── layout.tsx            # Root layout with metadata
│   └── page.tsx              # Main page component
├── components/
│   └── Dashboard.tsx         # Main dashboard UI component
├── lib/
│   ├── github.ts             # GitHub API client with rate limiting
│   └── repo-data.ts          # Data fetching and filtering logic
└── types/
    └── github.ts             # TypeScript type definitions
```

### Data Flow

1. **Client Request**: User enters a GitHub username
2. **API Call**: Dashboard component calls `/api/repos?username=...`
3. **Server-Side Fetch**: API route fetches data from GitHub API
4. **Rate Limiting**: Client tracks and displays remaining API requests
5. **Caching**: Next.js caching with 60-second cache duration
6. **Live Updates**: Auto-refresh every 30 seconds

### GitHub API Integration

- **Authentication**: Optional via `GITHUB_TOKEN` environment variable (increases rate limit from 60 to 5000 requests/hour)
- **Rate Limiting**: Tracks and displays remaining requests
- **Caching**: 1-minute cache to minimize API calls
- **Endpoints Used**:
  - `GET /users/{username}/repos` - List user repositories
  - `GET /repos/{owner}/{repo}/actions/runs` - Get workflow runs
  - `GET /repos/{owner}/{repo}/releases` - Get releases
  - `GET /repos/{owner}/{repo}/commits` - Get commits

## Usage

1. Open the dashboard
2. Enter a GitHub username
3. View repository status, build history, releases, and commits
4. Use filters to narrow down repositories
5. Click refresh to force update data

## Self-Hosting with Docker

### Prerequisites

- Docker and Docker Compose installed
- A domain name (optional, for production use)

### Quick Start with Docker Compose

1. **Clone and navigate to the project:**
   ```bash
   git clone <your-repo-url>
   cd github-repo-status
   ```

2. **Set environment variables (optional):**
   Create a `.env` file:
   ```bash
   GITHUB_TOKEN=ghp_your_personal_access_token
   ```

3. **Start the application:**
   ```bash
   # For standalone Next.js server (port 3000)
   docker compose up -d app

   # Or with Nginx reverse proxy (port 80)
   docker compose up -d app-nginx
   ```

4. **Access the dashboard:**
   - Standalone: http://localhost:3000
   - With Nginx: http://localhost

### Docker Images

#### Option 1: Standalone Next.js Server

Uses `Dockerfile` - Runs Next.js standalone server directly:

```bash
docker build -t github-status .
docker run -p 3000:3000 -e GITHUB_TOKEN=your_token github-status
```

#### Option 2: Next.js with Nginx

Uses `Dockerfile.nginx` - Nginx as reverse proxy with gzip compression:

```bash
docker build -f Dockerfile.nginx -t github-status-nginx .
docker run -p 80:80 -e GITHUB_TOKEN=your_token github-status-nginx
```

### Docker Compose Services

| Service | Port | Description |
|---------|------|-------------|
| `app` | 3000 | Next.js standalone server |
| `app-nginx` | 80 | Next.js with Nginx reverse proxy |

### Production Deployment

#### 1. Build and push to registry:
```bash
docker build -t your-registry/github-status:latest .
docker push your-registry/github-status:latest
```

#### 2. Deploy with Docker Compose:
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  app:
    image: your-registry/github-status:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
```

#### 3. With Nginx and SSL (Traefik example):
```yaml
version: '3.8'
services:
  traefik:
    image: traefik:v2.9
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.myresolver.acme.httpchallenge=true"
      - "--certificatesresolvers.myresolver.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.myresolver.acme.email=your@email.com"
    ports:
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - traefik_data:/data

  app:
    image: your-registry/github-status:latest
    expose:
      - "3000"
    environment:
      - NODE_ENV=production
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.app.rule=Host(\"dashboard.yourdomain.com\")"
      - "traefik.http.routers.app.tls.certresolver=myresolver"

volumes:
  traefik_data:
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | No | GitHub Personal Access Token for higher rate limits |
| `NODE_ENV` | No | Set to `production` for optimized builds |

### Resource Requirements

- **Minimum**: 512MB RAM, 1 CPU
- **Recommended**: 1GB RAM, 2 CPUs
- **Storage**: ~100MB for container image

## Environment Variables

- `GITHUB_TOKEN`: Optional GitHub Personal Access Token for higher rate limits

## Major Changes

### Version 0.1.0 (2026-01-09)

- Initial implementation
- Added GitHub API client with rate limiting
- Created responsive dashboard UI
- Implemented filtering and search
- Added auto-refresh functionality
- Added dark mode support

## Dependency Management

### Automated Updates (Dependabot)

This project uses GitHub Dependabot for automated dependency updates:

- **Weekly Schedule**: Dependabot checks for updates every Monday
- **Scope**: Both npm (Bun) and GitHub Actions
- **Configuration**: See `.github/dependabot.yml`

Dependabot will automatically:
- Create pull requests for available updates
- Include changelog and compatibility notes
- Attempt to auto-merge minor/patch updates
- Notify on breaking changes requiring manual review

### Manual Package Updates

If you need to manually update packages:

```bash
# Update all packages to latest versions
bun update

# Update a specific package
bun add package@latest

# Update dev dependencies
bun add -D package@latest

# View outdated packages
bun outdated
```

### Security Updates

For critical security vulnerabilities:

```bash
# Audit dependencies for security issues
bun audit

# Fix security issues automatically
bun audit fix
```

### Version Compatibility Notes

- **Next.js 15**: Requires React 19
- **Tailwind CSS v4**: New configuration format (no `tailwind.config.js`)
- **Bun**: Use `bun` instead of npm/yarn for all commands
