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