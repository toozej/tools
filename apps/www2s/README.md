# Webpage Reader Aloud

This application allows users to input a URL and have the webpage read aloud using the browser's native text-to-speech system. If the native system is unavailable, it falls back to a configurable TTS API using Mozilla's Readability library for text extraction.

## Key Features

- URL input form
- Text extraction from webpages using Readability
- Native browser TTS support (SpeechSynthesis API)
- Fallback to configurable TTS API
- Responsive UI with Tailwind CSS
- Self-hostable in Docker with environment variables

## Architecture

- Frontend: Next.js with React 19, TypeScript, Tailwind CSS
- API Routes: Text extraction and TTS generation
- Dependencies: @mozilla/readability, jsdom

## Environment Variables

Configure TTS settings using these environment variables:

- `TTS_ENDPOINT`: URL of the TTS API (e.g., `https://api.openai.com/v1/audio/speech`)
- `TTS_TOKEN`: Authentication token for the TTS API
- `TTS_MODEL`: Model name for TTS (optional, depends on API provider)