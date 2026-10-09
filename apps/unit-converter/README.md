# Unit Converter Web Application

## Project Purpose
A responsive web application for unit conversion using natural language input (e.g., "9 cups to ml") with optional dropdown selectors for "from" and "to" units, supporting both imperial and metric systems.

## Key Features
- Natural language parsing for conversion queries
- Optional dropdown menus for unit selection
- Support for multiple unit categories (volume, length, mass, temperature, etc.)
- Responsive design for mobile and desktop
- Conversion results after you select Convert

## Input format
Enter a value and two units. For example, enter `9 cups to ml` or `1 gal to qt`. You can use the abbreviations shown in the selectors. Signed and fractional values also work. For example, enter `-40 c to f` or `.5 l to ml`.

For volume conversions, `oz` means fluid ounces. For mass conversions, `oz` means ounces. If you enter only a number, select both units first.

## Architectural Decisions
- Built with Next.js 16, React 19, TypeScript, and Tailwind CSS v4
- Uses `convert-units` library for accurate unit conversions
- Client-side component for interactive conversion logic
- Server Components for layout and static content
- Responsive design using Tailwind CSS utilities

## Major Changes
- Initial setup with Next.js project structure
- Added convert-units dependency and types for conversion logic
- Implemented UnitConverter component with natural language parsing and optional dropdowns
- Added responsive UI with Tailwind CSS for mobile and desktop
- Fixed TypeScript and ESLint issues
- Fixed ambiguous unit handling (e.g., "oz" defaults to fluid ounces for volume conversions)
- Improved natural language parsing with more flexible spacing, input trimming, and additional unit mappings
