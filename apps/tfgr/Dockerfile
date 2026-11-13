FROM golang:1.27.4-trixie AS builder

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /tfgr ./cmd/tfgr

FROM debian:trixie-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl zlib1g \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --system --uid 10001 --create-home tfgr

COPY --from=builder /tfgr /usr/local/bin/tfgr

USER tfgr
EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/tfgr"]
CMD ["-listen", ":3000", "-open=false"]
