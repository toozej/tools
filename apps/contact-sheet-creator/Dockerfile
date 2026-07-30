# Build stage
FROM golang:1.26-trixie AS builder

WORKDIR /build

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY cmd ./cmd
COPY internal ./internal
COPY static ./static

# Build WASM binary and generate static site
RUN GOOS=js GOARCH=wasm go build -o bin/web/app.wasm -ldflags="-s -w" ./cmd/web/ && \
    go build -o bin/generate -ldflags="-s -w" ./cmd/web/ && cd bin/ && ./generate && rm -f ./generate

# Create final output directory and copy all static + generated files to out directory
RUN mkdir -p /app/out && cp -r bin/* /app/out/ && cp -r static /app/out/

FROM alpine:3.22

RUN addgroup -S app && adduser -S app -G app && \
    mkdir -p /app/out && chown -R app:app /app

COPY --from=builder --chown=app:app /app/out /app/out

USER app
WORKDIR /app
CMD ["sleep", "infinity"]
