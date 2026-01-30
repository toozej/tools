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

# Stage 2: Copy built static files to output directory
FROM busybox:latest

# Copy the exported static files from builder
COPY --from=builder /app/out /output

# The container will exit after copying files to the volume mount