# YAML Validator Web Application

## Project Purpose
A responsive web application for validating and formatting YAML content. Users can input YAML via copy/paste or file upload, validate its syntax, and format it with configurable indentation spacing. All data is stored locally in the browser.

## Key Features
- YAML syntax validation
- Configurable indentation spacing (2, 4, or 6 spaces)
- Copy/paste YAML input
- File upload functionality
- Local storage for persistence
- Responsive design for mobile and desktop
- Real-time validation feedback
- Copy formatted YAML to clipboard
- Download formatted YAML as file

## Architectural Decisions
- Built with Next.js 15, React 19, TypeScript, and Tailwind CSS v4
- Client-side validation using js-yaml library
- No server-side storage; all data handled in browser
- Server Components by default, with "use client" for interactive components
- Uses localStorage for saving YAML content

## Major Changes
- Initial setup with Next.js and dependencies
- Added YAML validation and formatting functionality using js-yaml library
- Implemented file upload and local storage for YAML content
- Ensured responsive design with Tailwind CSS grid system
- Created YamlValidator component with client-side interactivity
- Added copy to clipboard and download features for formatted YAML