# URL to EPUB Converter

## Project Purpose
A web application that converts any inputted URL into an EPUB file. Users can customize the output by including or excluding media (graphics) and optimizing for e-ink devices with small screens.

## Key Features
- URL input field for the webpage to convert
- Checkbox to enable/disable inclusion of media (images)
- Checkbox for e-ink optimization (smaller images, optimized formatting)
- Progress bar showing conversion completion
- Download button for the generated EPUB file
- Responsive design for mobile and desktop
- Local browser storage (IndexedDB) for temporary files and output EPUB

## Architectural Decisions
- Built with Next.js 14, React 19, TypeScript, and Tailwind CSS v4
- Client-side processing to avoid server load and comply with local storage requirement
- Uses Mozilla Readability for content extraction from HTML
- JSZip for creating EPUB files (ZIP-based format)
- IndexedDB for storing generated EPUB blobs
- No server-side API routes for conversion; all processing in browser

## Major Changes
- Initial implementation: Basic UI and conversion logic