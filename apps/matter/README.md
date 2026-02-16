# Matter - Image Border Adder

A modern, responsive web application for adding customizable borders and mats to your images. Built with Next.js 16, React 19, and Tailwind CSS 4.

## Overview

Matter allows you to easily add professional-looking borders and mats to your images. Whether you're preparing photos for printing, social media, or just want to give your images a polished look, Matter provides a simple and intuitive interface to customize your borders.

### Key Features

- **Multiple Upload Methods**: Upload images via file browser, drag & drop, paste from clipboard, or load from URL
- **Customizable Borders**: Adjust outer and inner border widths independently
- **Color Selection**: Choose any color for your borders with an intuitive color picker
- **EXIF Orientation Support**: Automatically detects and corrects image orientation from EXIF metadata
- **Real-time Preview**: See your changes instantly with canvas-based rendering
- **One-click Download**: Export your matted image as PNG with a single click
- **Responsive Design**: Works beautifully on desktop and mobile devices

## Usage

### Uploading Images

You can upload images in four ways:

1. **File Browser**: Click the upload area to open a file picker
2. **Drag & Drop**: Drag an image file directly onto the upload area
3. **Paste**: Copy an image and paste it (Ctrl/Cmd + V) anywhere on the page
4. **URL**: Enter an image URL in the input field and click "Load"

### Customizing Borders

#### Outer Border
- Use the slider to adjust width (0-200px)
- Click the color picker or enter a hex color code
- Default: White (#ffffff)

#### Inner Border
- Toggle the inner border on/off using the switch
- Use the slider to adjust width (0-100px)
- Click the color picker or enter a hex color code
- Default: Black (#000000)

### Downloading

Once you're happy with your borders, click the "Download Matted Image" button to save your image as a PNG file.

## Installation

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 20+
- Git

### Quick Start

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd matter
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Start the development server:
   ```bash
   bun dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
bun build
bun start
```

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| [Next.js](https://nextjs.org/) | 16.x | React framework with App Router |
| [React](https://react.dev/) | 19.x | UI library |
| [TypeScript](https://www.typescriptlang.org/) | 5.9.x | Type-safe JavaScript |
| [Tailwind CSS](https://tailwindcss.com/) | 4.x | Utility-first CSS framework |
| [Bun](https://bun.sh/) | Latest | Package manager & runtime |
| [exif-js](https://github.com/exif-js/exif-js) | 2.3.0 | EXIF data extraction for image orientation |

### Project Structure

```
matter/
├── src/
│   └── app/
│       ├── page.tsx        # Main application component
│       ├── layout.tsx      # Root layout with metadata
│       └── globals.css     # Global styles (Tailwind)
├── public/                 # Static assets
├── CREDITS.md              # Attribution and credits
└── README.md               # This file
```
