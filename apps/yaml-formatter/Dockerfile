# Stage 1: Build the application with static export
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy source files
COPY . .

# Build the application with static export
RUN bun run build

CMD ["bun", "run", "start"]