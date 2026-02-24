# TFPS (Terraform Plan Summary)

A web-based tool for summarizing and formatting Terraform or Terragrunt `plan` output into readable, shareable summaries.

## Features

### Input Methods
- **File Upload**: Upload JSON or binary plan files via file explorer
- **Paste JSON**: Paste plan JSON directly (from `terraform show -json` output)
- **Paste Text Output**: Paste raw `terraform plan` or `terragrunt plan` output

### Output Formatting
- Changes grouped by module for easy navigation
- Emoji indicators for action types:
  - ➕ Add (create)
  - 🔄 Change (update)
  - ♻️ Replace (destroy and recreate)
  - ❌ Destroy (delete)
- Destructive actions (destroy/replace) are prominently highlighted

### Export Options
- **Markdown Export**: Get a formatted markdown summary with headings and emoji
- **Plaintext Export**: Get a plain text summary without emoji or special characters

## Usage

1. **Upload or Paste Your Plan**
   - Drag & drop a plan file, click to browse, or paste plan output directly

2. **Review the Summary**
   - Changes are grouped by module
   - Each section shows the resource type, name, and action
   - Destructive actions appear with clear warnings

3. **Export the Summary**
   - Click "Copy Markdown" for formatted output (includes emoji)
   - Click "Copy Plaintext" for clean text output (no emoji)

### Generating Plan Files

**JSON format (recommended):**
```bash
terraform plan -out=plan.tfplan
terraform show -json plan.tfplan > plan.json
```

**Text format:**
```bash
terraform plan > plan.txt
```

## Installation

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 20+
- Git

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd apps/tfps

# Install dependencies
bun install

# Start development server
bun dev
```

The application will be available at `http://localhost:3000`.

### Build for Production

```bash
bun run build
```

The static output is exported to the `out/` directory.

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| [Next.js](https://nextjs.org/) | 16.x | React framework with App Router |
| [React](https://react.dev/) | 19.x | UI library |
| [TypeScript](https://www.typescriptlang.org/) | 5.9.x | Type-safe JavaScript |
| [Tailwind CSS](https://tailwindcss.com/) | 4.x | Utility-first CSS framework |
| [Bun](https://bun.sh/) | Latest | Package manager & runtime |

### Project Structure

```
tfps/
├── src/
│   ├── app/
│   │   ├── layout.tsx      # Root layout with metadata
│   │   ├── page.tsx        # Main page component
│   │   └── globals.css     # Global styles
│   └── components/         # React components
├── public/                 # Static assets
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── README.md               # This file
```

## Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start development server |
| `bun build` | Build for production |
| `bun start` | Start production server |
| `bun lint` | Run ESLint |
| `bun typecheck` | Run TypeScript type checking |

## Browser Support

- Modern browsers (ES2020+)
- Chrome, Firefox, Safari, Edge (latest versions)
