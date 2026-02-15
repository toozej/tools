# ocr

From https://github.com/simonw/tools/blob/main/ocr.html

Extract text from PDF documents and images using optical character recognition (OCR) directly in your browser. The tool leverages Tesseract.js for text recognition and PDF.js to handle multi-page PDF files, supporting multiple languages and file formats including JPEG, PNG, and GIF. All processing occurs locally in your browser with no files being transmitted to external servers.

## Styling

This app uses a shared `style.css` stylesheet inspired by the homepage design, providing:
- CSS variables for light/dark mode via `prefers-color-scheme`
- Consistent layout classes (`.page`, `.container`, `.hero`, `.card`)
- Form controls and button styling
- Accessible focus rings and high-contrast selection

When copying or updating this app, maintain the wrapper structure (`<main class="page"><div class="container">...`) and keep the stylesheet link.

<!-- Generated from commit: c335adf1faeb762d474771d17a2d0c8e41204fb0 -->