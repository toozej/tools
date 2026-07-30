FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY . .
RUN bun run build

FROM alpine:3.22

WORKDIR /app
RUN apk upgrade --no-cache && addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder --chown=appuser:appgroup /app/out ./out

USER appuser
CMD ["sleep", "infinity"]
