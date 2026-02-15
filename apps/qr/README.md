# qr

From https://github.com/simonw/tools/blob/main/qr.html

Decode QR codes from image files by uploading, dragging and dropping, or pasting them directly into the application. The decoder processes the image data using the jsQR library to extract and display the encoded content, automatically converting URLs into clickable links for convenient access.

## Styling

This app uses a shared `style.css` stylesheet inspired by the homepage design, providing:
- CSS variables for light/dark mode via `prefers-color-scheme`
- Consistent layout classes (`.page`, `.container`, `.hero`, `.card`)
- Form controls and button styling
- Accessible focus rings and high-contrast selection

When copying or updating this app, maintain the wrapper structure (`<main class="page"><div class="container">...`) and keep the stylesheet link.

<!-- Generated from commit: 345bdc992ffa314a78473541afb6815d215eec0b -->