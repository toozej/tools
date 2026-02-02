# GitHub Private Gist Creator

## Project Purpose
A web application that allows users to create private GitHub gists from clipboard content or uploaded files. The app provides a simple interface to paste text or select a file, creates a private gist via GitHub API, and returns the gist link while copying it to the clipboard.

## Key Features
- Paste content from clipboard
- Upload files via file browser
- Create private GitHub gists
- Responsive design for mobile and desktop
- GitHub OAuth authentication
- Automatic link copying to clipboard

## Architectural Decisions
- Built with Next.js 15, React 19, TypeScript, and Tailwind CSS v4
- Uses NextAuth.js for GitHub OAuth authentication
- Server components for static parts, client components for interactive elements
- API routes for gist creation to handle server-side GitHub API calls
- Responsive design using Tailwind CSS utilities

## Major Changes
- Initial setup with Next.js and Tailwind
- Added NextAuth for GitHub authentication
- Implemented gist creation API route
- Added file upload and clipboard paste functionality
- Made UI responsive
- Fixed TypeScript types and linting issues

## Setup Instructions

To run this application, you need to configure a GitHub OAuth App and set up several environment variables.

### 1. Configure GitHub OAuth App

1.  Go to your GitHub profile settings: **Settings** > **Developer settings** > **OAuth Apps**.
2.  Click **New OAuth App**.
3.  Fill in the following details:
    *   **Application name:** Choose a descriptive name (e.g., "Clip2Gist Dev").
    *   **Homepage URL:**
        *   For local development (e.g., via Docker Compose): `http://localhost:8080/clip2gist`
        *   For production: The base URL where your app is hosted (e.g., `https://yourdomain.com/clip2gist`)
    *   **Authorization callback URL:**
        *   For local development: `http://localhost:8080/clip2gist/api/auth/callback/github`
        *   For production: `https://yourdomain.com/clip2gist/api/auth/callback/github`
    *   **Application description:** Optional, but good practice.
4.  Click **Register application**.
5.  After registration, you will be provided with a **Client ID** and a **Client Secret**. Keep these safe; you will need them for the environment variables.

### 2. Configure Environment Variables

Create an `app.env` file in the `./apps/clip2gist/` directory (if it doesn't already exist). This file should contain the following variables:

```env
# A long, random string used by NextAuth.js to sign and encrypt session tokens.
# Generate one using `openssl rand -base64 32` in your terminal.
NEXTAUTH_SECRET="YOUR_VERY_LONG_AND_RANDOM_SECRET_STRING_HERE"

# Your GitHub OAuth App Client ID (obtained from Step 1)
GITHUB_ID="your_github_client_id"

# Your GitHub OAuth App Client Secret (obtained from Step 1)
GITHUB_SECRET="your_github_client_secret"

# The full URL to your clip2gist app, including the basePath.
# Examples:
# For local development: http://localhost:8080/clip2gist
# For production: https://yourdomain.com/clip2gist
NEXTAUTH_URL="http://localhost:8080/clip2gist"
```

**Important Notes:**

*   Replace the placeholder values (`YOUR_VERY_LONG_AND_RANDOM_SECRET_STRING_HERE`, `your_github_client_id`, `your_github_client_secret`, `http://localhost:8080/clip2gist`) with your actual values.
*   Ensure your deployment environment correctly loads these environment variables. If using Docker Compose, verify that `app.env` is correctly referenced in `docker-compose-example.yml` for the `clip2gist` service.
