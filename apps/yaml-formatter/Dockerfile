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

# Create non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Set ownership of the app directory
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

CMD ["bun", "run", "start"]