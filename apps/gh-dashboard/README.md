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
