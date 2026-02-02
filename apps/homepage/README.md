# Tools Collection Homepage

A modern, responsive web application that serves as a homepage for displaying a collection of web tools and utilities. The site dynamically loads app information from a JSON file and presents it in a beautiful, card-based grid layout.

## Features

- **Responsive Design**: Mobile-first grid layout that adapts from 1 column (mobile) to 2 columns (tablet) to 3 columns (desktop)
- **Modern UI**: Clean cards with gradient accents, hover animations, and smooth transitions
- **Dark Mode Support**: Full dark mode compatibility with automatic system preference detection
- **Static Generation**: Pre-rendered at build time for optimal performance and SEO
- **Accessible**: Semantic HTML and proper link handling for screen readers
- **Type Safe**: Built with TypeScript for robust code quality

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [Next.js 16](https://nextjs.org/) | React framework with App Router |
| [React 19](https://react.dev/) | UI library |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe JavaScript |
| [Tailwind CSS 4](https://tailwindcss.com/) | Utility-first CSS framework |
| [Bun](https://bun.sh/) | Package manager and runtime |

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout with metadata
│   │   ├── page.tsx        # Homepage with app grid
│   │   ├── globals.css     # Global styles & Tailwind imports
│   │   └── favicon.ico     # Site icon
│   └── data/
│       └── colophon.json   # App data source
├── next.config.ts          # Next.js configuration
├── package.json            # Dependencies and scripts
└── README.md               # This file
```

## How It Works

The application reads app information from [`src/data/colophon.json`](src/data/colophon.json) and renders it as a grid of interactive cards. Each card displays:

- A gradient icon with the app's initial
- The app title
- A description of what the app does
- Tags (when available)
- A hover effect revealing an "Open app" action

### Data Format

The `colophon.json` file follows this structure:

```json
{
  "generated_at": "2026-01-31T02:39:49.505466Z",
  "total_apps": 7,
  "apps": [
    {
      "name": "app-name",
      "title": "App Display Title",
      "description": "Description of what the app does...",
      "tags": ["tag1", "tag2"],
      "url": "/app-url",
      "credits": [],
      "has_credits": false
    }
  ]
}
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) installed on your system
- Node.js 20+ (for compatibility)

### Installation

1. Clone or download the project
2. Install dependencies:

```bash
bun install
```

### Development

Run the development server:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The page will auto-reload when you make changes. Updates to `colophon.json` will reflect immediately after refreshing the browser.

### Building for Production

Create a production build:

```bash
bun run build
```

This generates static files in the `dist/` directory, ready for deployment to any static hosting service.

### Code Quality

Run type checking:

```bash
bun typecheck
```

Run linting:

```bash
bun lint
```

## Adding a New App

To add a new app to the collection:

1. From the root of the repo, run `uv run colophon --output /Users/james/src/github/toozej/tools/apps/homepage/src/data/colophon.json`
2. Rebuild the project: `bun run build`

## Customization

### Styling

The app uses Tailwind CSS for styling. Global styles are defined in [`src/app/globals.css`](src/app/globals.css). The color scheme uses:

- Slate grays for text and backgrounds
- Blue and purple gradients for accents
- Responsive breakpoints: `sm:`, `md:`, `lg:`

### Metadata

Update the site title and description in [`src/app/layout.tsx`](src/app/layout.tsx):

```tsx
export const metadata: Metadata = {
  title: "Your Site Title",
  description: "Your site description",
};
```

## Deployment

The project is configured for static export. The `dist/` folder contains all files needed for deployment:

- **Vercel**: Connect your Git repository for automatic deployments
- **Netlify**: Drag and drop the `dist/` folder
- **GitHub Pages**: Push the `dist/` contents to a `gh-pages` branch
- **Any static host**: Upload the `dist/` folder contents

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun install` | Install dependencies |
| `bun dev` | Start development server |
| `bun run build` | Create production build |
| `bun start` | Start production server |
| `bun lint` | Run ESLint |
| `bun typecheck` | Run TypeScript type checking |
