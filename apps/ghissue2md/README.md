# ghissue2md

From https://github.com/simonw/tools/blob/main/github-issue-to-markdown.html

# Documentation

Convert GitHub issues and pull requests to markdown format by providing their URL and an optional personal access token for private repositories. The tool automatically fetches the issue details, all comments, and expands any inline code references with their actual content from the repository. Your GitHub token is securely stored in your browser's local storage for convenient access on subsequent visits.

## Styling

This app uses a shared `style.css` stylesheet inspired by the homepage design, providing:
- CSS variables for light/dark mode via `prefers-color-scheme`
- Consistent layout classes (`.page`, `.container`, `.hero`, `.card`)
- Form controls and button styling
- Accessible focus rings and high-contrast selection

When copying or updating this app, maintain the wrapper structure (`<main class="page"><div class="container">...`) and keep the stylesheet link.

<!-- Generated from commit: 2a0a0c26db427db87f0aa937c96a7da01b8f8994 -->