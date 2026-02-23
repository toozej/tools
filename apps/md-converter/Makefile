# Set sane defaults for Make
SHELL = bash
.DELETE_ON_ERROR:
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules

# Set default goal such that `make` runs `make help`
.DEFAULT_GOAL := help

# Build info
BUILDER = $(shell whoami)@$(shell hostname)
NOW = $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

# Version control (suppressing errors if not a git repo)
VERSION = $(shell git describe --tags --dirty --always 2>/dev/null || echo "unknown")
COMMIT = $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BRANCH = $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

# Linker flags
PKG = $(shell (head -n 1 go.mod 2>/dev/null || echo "module anki-converter") | cut -d ' ' -f 2)
LDFLAGS = -s -w \
	-X main.Version=$(or $(VERSION),unknown) \
	-X main.Commit=$(or $(COMMIT),unknown) \
	-X main.BuiltAt=$(NOW)

# Define the repository URL
REPO_URL := https://github.com/toozej/tools

# Detect the OS and architecture
OS := $(shell uname -s)
ARCH := $(shell uname -m)

ifeq ($(OS), Linux)
	OPENER=xdg-open
else
	OPENER=open
endif

.PHONY: all vet test build verify run up down distroless-build distroless-run install local local-vet local-test local-cover local-run local-kill local-iterate local-release-test local-release local-sign local-verify local-release-verify local-install get-cosign-pub-key docker-login pre-commit-install pre-commit-run pre-commit pre-reqs update-golang-version upload-secrets-to-gh upload-secrets-envfile-to-1pass docs diagrams mutation-test test-changed watch-test profile-cpu profile-mem profile-all benchmark clean help

all: vet test build run ## Run default workflow via Docker
local: local-vendor local-vet local-test local-build local-run ## Run default workflow using locally installed Golang toolchain

vet: ## Run `go vet` in Docker
	docker build --target vet -f $(CURDIR)/Dockerfile -t toozej/tools:anki-converter . 

test: ## Run tests in Docker
	docker build --target builder -f $(CURDIR)/Dockerfile -t toozej/tools:anki-converter .

build: ## Build generation Docker image
	docker build -f $(CURDIR)/Dockerfile -t toozej/tools:anki-converter-gen .

build-server: ## Build serving Docker image
	# Ensure bin directory is populated first (e.g., via docker run of generator)
	docker build -f $(CURDIR)/Dockerfile.serve -t toozej/tools:anki-converter-serve .

run: ## Run serving Docker image
	docker run --rm -p 8081:8080 toozej/tools:anki-converter-serve

local-update-deps: ## Run `go get -t -u ./...` to update Go module dependencies
	go get -t -u ./...

local-vet: ## Run `go vet` using locally installed golang toolchain
	go vet $(CURDIR)/...

local-vendor: ## Run `go mod tidy & vendor` using locally installed golang toolchain
	go mod tidy
	go mod vendor

local-test: ## Run `go test`
	go test -v ./...

local-cover: ## View coverage report
	go test -coverprofile=c.out ./... && go tool cover -html=c.out

local-build: ## Build WASM, native generator, and run generator
	mkdir -p bin/web
	GOOS=js GOARCH=wasm go build -o bin/web/app.wasm -ldflags="$(LDFLAGS)" ./cmd/web
	go build -o bin/generate -ldflags="$(LDFLAGS)" ./cmd/web
	cd bin && ./generate
	echo '<meta http-equiv="refresh" content="0; url=/anki-converter/">' > redirect.html
	@echo "Local build complete. Assets are in bin/"

local-run: ## Run locally built generator or serve static files
	if test -e $(CURDIR)/.env; then \
		export `cat $(CURDIR)/.env | xargs` && cd bin && ./generate; \
	elif test -d $(CURDIR)/bin; then \
		echo "Serving static files from bin/ via python..." && cd bin && python3 -m http.server 8080; \
	else \
		echo "Nothing to run. Try 'make local-build' first."; \
	fi

pre-commit: pre-commit-install pre-commit-run ## Install and run pre-commit hooks

pre-commit-install: ## Install pre-commit hooks and necessary binaries
	command -v apt && apt-get update || echo "package manager not apt"
	# golangci-lint
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	# goimports
	go install golang.org/x/tools/cmd/goimports@latest
	# gosec
	go install github.com/securego/gosec/v2/cmd/gosec@latest
	# staticcheck
	go install honnef.co/go/tools/cmd/staticcheck@latest
	# go-critic
	go install github.com/go-critic/go-critic/cmd/go-critic@latest
	# structslop
	# go install github.com/orijtech/structslop/cmd/structslop@latest
	# shellcheck
	command -v shellcheck || brew install shellcheck || apt install -y shellcheck || sudo dnf install -y ShellCheck || sudo apt install -y shellcheck
	# checkmake
	go install github.com/checkmake/checkmake/cmd/checkmake@latest
	# goreleaser
	go install github.com/goreleaser/goreleaser/v2@latest
	# actionlint
	command -v actionlint || brew install actionlint || go install github.com/rhysd/actionlint/cmd/actionlint@latest
	# syft
	command -v syft || curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
	# cosign
	go install github.com/sigstore/cosign/cmd/cosign@latest
	# go-licenses
	go install github.com/google/go-licenses@latest
	# go vuln check
	go install golang.org/x/vuln/cmd/govulncheck@latest
	# air
	go install github.com/air-verse/air@latest
	# graphviz for dot
	command -v dot || brew install graphviz || sudo apt install -y graphviz || sudo dnf install -y graphviz
	# install and update pre-commits
	# determine if on Debian 12 and if so use pip to install more modern pre-commit version
	grep --silent "VERSION=\"12 (bookworm)\"" /etc/os-release && apt install -y --no-install-recommends python3-pip && python3 -m pip install --break-system-packages --upgrade pre-commit || echo "OS is not Debian 12 bookworm"
	command -v pre-commit || brew install pre-commit || sudo dnf install -y pre-commit || sudo apt install -y pre-commit
	pre-commit install
	pre-commit autoupdate

pre-commit-run: ## Run pre-commit hooks against all files
	pre-commit run --all-files
	# manually run the following checks since their pre-commits aren't working or don't exist
	go-licenses report github.com/toozej/golang-starter/cmd/golang-starter
	govulncheck ./...

docs: ## Serve Go documentation
	@echo "Starting Go documentation server on localhost"
	@echo "Use Ctrl+C to stop the server"
	go doc -http

clean: ## Remove any locally compiled binaries and profiles
	rm -f $(CURDIR)/bin/generate
	rm -rf $(CURDIR)/profiles/

help: ## Display help text
	@grep -E '^[a-zA-Z_-]+ ?:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

