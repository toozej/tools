# Taboo Game Project

## Project Purpose
This is a web-based implementation of the Taboo word game, built with Next.js, React 19, TypeScript, and Tailwind CSS v4. The application allows players to play the classic Taboo game entirely within the browser, with responsive design for mobile and desktop, including buzzer and timer functionality.

## Key Features
- Two-team gameplay with turn-based clue-giving
- Card-based system with target words and taboo words
- Buzzer for rule violations
- Countdown timer for rounds
- Score tracking and display
- Responsive UI for mobile and desktop

## Architectural Decisions
- Client-side state management using React hooks (useState, useEffect)
- No database required as game state is ephemeral
- Audio API for buzzer sound
- Tailwind CSS for styling with mobile-first responsive design
- Server Components for layout, Client Components for interactive game logic

## Major Changes
- Initial setup: Created basic Next.js project structure
- Added game components and logic for Taboo gameplay
- Added Docker deployment configuration with multi-stage Dockerfile using Bun and Nginx, along with docker-compose.yml and deployment documentation