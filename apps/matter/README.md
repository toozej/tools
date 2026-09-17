# Matter - Image Border Adder

A modern, responsive web application for adding customizable borders and mats to your images. Built with Next.js 16, React 19, and Tailwind CSS 4.

## Overview

Matter allows you to easily add professional-looking borders and mats to your images. Whether you're preparing photos for printing, social media, or just want to give your images a polished look, Matter provides a simple and intuitive interface to customize your borders.

### Key Features

- **Image Collections**: Upload image files, a folder of images, or a ZIP archive of images
- **Panel Layouts**: Create side-by-side or stacked diptychs, row or column triptychs, and a feature triptych
- **Customizable Borders**: Adjust outer and inner border widths independently
- **Color Selection**: Choose any color for your borders with an intuitive color picker
- **EXIF Orientation Support**: Automatically detects and corrects image orientation from EXIF metadata
- **Real-time Preview**: See your changes instantly with canvas-based rendering
- **One-click Download**: Export your matted image as PNG with a single click
- **Responsive Design**: Works beautifully on desktop and mobile devices

## Usage

### Uploading Images

You can load images in several ways:

1. **Images or ZIP**: Select one or more image files, or select a ZIP archive that contains image files.
2. **Folder**: Select a folder that contains image files.
3. **Drag and Drop**: Drag image files or a ZIP archive onto the upload area.
4. **Paste**: Copy image files and paste them (Ctrl/Cmd + V) anywhere on the page.
5. **URL**: Enter one image URL and click "Load".

Matter sorts uploaded images by file name. Select the images for a layout in the order that they must appear. Matter crops each image to fill its panel.

### Selecting a Layout

Select one of these layouts before you select the images:

- Single image
- Side-by-side diptych
- Stacked diptych
- Three-panel row
- Three-panel column
- Feature triptych with one tall image and two stacked images

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

Select PNG, PDF, JPG, or WEBP. Click the download button to save the layout in that format.

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
