# render-markdown

From https://github.com/simonw/tools/blob/main/render-markdown.html

Convert Markdown text to HTML using GitHub's official Markdown API, with options to render standard Markdown or GitHub Flavored Markdown (GFM). The tool displays a live preview of the rendered content, automatically generates a table of contents for headings, and provides the raw HTML output for copying, while also offering cleanup options to remove GitHub-specific formatting artifacts.

## Styling

This app uses a shared `style.css` stylesheet inspired by the homepage design, providing:
- CSS variables for light/dark mode via `prefers-color-scheme`
- Consistent layout classes (`.page`, `.container`, `.hero`, `.card`)
- Form controls and button styling
- Accessible focus rings and high-contrast selection

When copying or updating this app, maintain the wrapper structure (`<main class="page"><div class="container">...`) and keep the stylesheet link.

<!-- Generated from commit: 8bd1066f6452c4aba20ab8c2764f74ae9cadf9b9 -->