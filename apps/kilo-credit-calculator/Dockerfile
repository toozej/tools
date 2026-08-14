FROM oven/bun:1-alpine AS dependencies

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules

COPY . .
RUN ./node_modules/.bin/next build

FROM alpine:3.22

WORKDIR /app
RUN apk upgrade --no-cache && addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder --chown=appuser:appgroup /app/out ./out

USER appuser
CMD ["sleep", "infinity"]
