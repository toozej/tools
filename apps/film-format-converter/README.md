# Lens Focal Length Equivalence Converter

Convert lens focal lengths between different film formats and digital sensor sizes.

## Purpose
Calculate equivalent focal lengths when moving lenses between camera systems, film formats, and video sensor sizes. This converter uses diagonal crop factor calculations to maintain identical field of view across different sensor dimensions.

## Features
- **21 supported formats** including 35mm full frame, APS-C, Micro Four Thirds, Nikon 1, medium format, large format, and motion picture film formats
- Formats grouped and sorted by physical sensor area (smallest to largest)
- Real-time calculations with precision to 0.1mm
- Displays crop factors for both source and target formats
- Responsive UI for mobile and desktop devices
- Dark mode support

## Usage
1. Enter your lens focal length in millimeters
2. Select the source format that the lens is designed for
3. Select the target format you want the equivalent focal length for

The equivalent focal length will be automatically calculated and displayed.

## Format Categories
- **Digital Sensors**: Nikon 1, MFT, APS-C, Full Frame, Medium Format digital backs
- **Analog Film**: 35mm, 120 medium format, 4x5 / 5x7 / 8x10 large format
- **Video / Motion Picture**: Super 8, 8mm, 16mm, Super 16mm, 35mm Academy

## Technology Stack
- Next.js 16 (Static Export)
- React 19
- TypeScript
- Tailwind CSS 4
- Bun runtime

All calculations are performed client-side.
