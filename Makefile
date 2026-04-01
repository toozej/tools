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

# Optional app name for app-specific targets
APP ?=

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

.PHONY: all test build build-docker run iterate up down dev dev-down dev-logs dev-nc local pre-commit-install pre-commit-run pre-commit pre-reqs clean rebuild-app help

all: clean up ## Run default workflow via Docker
local: pre-commit dev-nc ## Run dev workflow using Docker
pre-reqs: pre-commit-install ## Install pre-commit hooks and necessary binaries

test: ## Run tests for a specific app (usage: make test APP=namehere)
	@if [ -z "$(APP)" ]; then \
		echo "Error: APP variable is required. Usage: make test APP=<app-name>"; \
		exit 1; \
	fi
	@if [ ! -d "apps/$(APP)" ]; then \
		echo "Error: App '$(APP)' not found in apps/ directory"; \
		exit 1; \
	fi
	@echo "Running tests for app: $(APP)"
	@# Determine app language
	@FAILED=0; \
	if [ -f "apps/$(APP)/go.mod" ]; then \
		echo "Detected Go app, running go test..."; \
		(cd apps/$(APP) && go test -v ./...) || FAILED=1; \
	fi; \
	if [ -f "apps/$(APP)/package.json" ]; then \
		echo "Detected JavaScript app, running tests..."; \
		JS_TEST_FILES=$$(find apps/$(APP)/src -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | grep -v node_modules); \
		if [ -n "$$JS_TEST_FILES" ]; then \
			(cd apps/$(APP) && bun test) || FAILED=1; \
		else \
			echo "No test files found, skipping"; \
		fi; \
	fi; \
	if [ -f "apps/$(APP)/index.html" ]; then \
		echo "Detected HTML app, no tests to run"; \
	fi; \
	PYTEST_FILES=$$(cd apps/$(APP) && find . -name "test_*.py" -o -name "*_test.py" 2>/dev/null); \
	if [ -n "$$PYTEST_FILES" ]; then \
		echo "Detected Python tests, running pytest..."; \
		(cd apps/$(APP) && uv run --with pytest --with pytest-asyncio --with aiohttp pytest -v $$PYTEST_FILES) || FAILED=1; \
	fi; \
	if [ "$$FAILED" -ne 0 ]; then \
		echo "Some tests failed"; exit 1; \
	fi

build: ## Build a specific app locally (usage: make build APP=namehere)
	@if [ -z "$(APP)" ]; then \
		echo "Error: APP variable is required. Usage: make build APP=<app-name>"; \
		exit 1; \
	fi
	@if [ ! -d "apps/$(APP)" ]; then \
		echo "Error: App '$(APP)' not found in apps/ directory"; \
		exit 1; \
	fi
	@echo "Building app: $(APP)"
	@# Determine app language
	@if [ -f "apps/$(APP)/go.mod" ]; then \
		echo "Detected Go app, building WASM and generating static site..."; \
		cd apps/$(APP) && rm -rf bin/ out/ && \
		mkdir -p bin/web/ && \
		GOOS=js GOARCH=wasm go build -o bin/web/app.wasm -ldflags="-s -w" ./cmd/web/ && \
     	go build -o bin/generate -ldflags="-s -w" ./cmd/web/ && \
		cd bin/ && ./generate && rm -f ./generate && \
		cd .. && mkdir -p out/ && cp -r bin/* out/ && cp -r static out/; \
	elif [ -f "apps/$(APP)/package.json" ]; then \
		echo "Detected JavaScript app, running bun install and bun run build..."; \
		cd apps/$(APP) && bun install && bun run build; \
	elif [ -f "apps/$(APP)/index.html" ]; then \
		echo "Detected HTML app, no build steps needed"; \
	else \
		echo "Warning: No buildable files found (go.mod, package.json, or index.html) for app '$(APP)'; skipping build"; \
	fi

run: ## Run a specific app locally (usage: make run APP=namehere)
	@if [ -z "$(APP)" ]; then \
		echo "Error: APP variable is required. Usage: make run APP=<app-name>"; \
		exit 1; \
	fi
	@if [ ! -d "apps/$(APP)" ]; then \
		echo "Error: App '$(APP)' not found in apps/ directory"; \
		exit 1; \
	fi
	@echo "Running app: $(APP)"
	@# Determine app language
	@if [ -f "apps/$(APP)/go.mod" ]; then \
		echo "Detected Go app, serving out/ directory with Python web server on port 8080 at /$(APP)/..."; \
		pkill -9 -f "python3 -m http.server 8080" 2>/dev/null || true; \
		TMP_DIR=$$(mktemp -d); \
		mkdir -p "$$TMP_DIR/$(APP)"; \
		cp -r "apps/$(APP)/out"/* "$$TMP_DIR/$(APP)/"; \
		(cd "$$TMP_DIR" && python3 -m http.server 8080) & \
		SRV_PID=$$!; \
		trap 'echo "Cleaning up Python server (PID: $$SRV_PID) and temp dir..."; kill $$SRV_PID 2>/dev/null || true; rm -rf "$$TMP_DIR"; exit 0' EXIT SIGINT SIGTERM; \
		wait $$SRV_PID; \
	elif [ -f "apps/$(APP)/package.json" ]; then \
		echo "Detected JavaScript app, running bun install and bun run dev..."; \
		cd apps/$(APP) && bun install && bun run dev; \
	elif [ -f "apps/$(APP)/index.html" ]; then \
		echo "Detected HTML app, opening in browser..."; \
		$(OPENER) apps/$(APP)/index.html; \
	else \
		echo "Warning: No runnable files found (go.mod, package.json, or index.html) for app '$(APP)'; skipping run"; \
	fi

iterate: ## Run `make build run` via `air` any time a .go or .tmpl file changes
	@if [ -z "$(APP)" ]; then \
		echo "Error: APP variable is required. Usage: make run APP=<app-name>"; \
		exit 1; \
	fi
	@if [ ! -d "apps/$(APP)" ]; then \
		echo "Error: App '$(APP)' not found in apps/ directory"; \
		exit 1; \
	fi
	@echo "Running app: $(APP)"
	@# Determine app language
	@if [ -f "apps/$(APP)/go.mod" ]; then \
		echo "Detected Go app, running air..."; \
		(cd apps/$(APP) && air) & \
		AIR_PID=$$!; \
		trap 'echo "Stopping Air (PID: $$AIR_PID) and cleaning up processes..."; kill $$AIR_PID 2>/dev/null || true; pkill -9 -f "python3 -m http.server 8080" 2>/dev/null || true; exit 0' EXIT SIGINT SIGTERM; \
		wait $$AIR_PID; \
	else \
		echo "Warning: No runnable files found (go.mod) for app '$(APP)'; skipping run"; \
	fi

build-docker: ## Build Docker image for a specific app (usage: make build-docker APP=namehere)
	@if [ -z "$(APP)" ]; then \
		echo "Error: APP variable is required. Usage: make build-docker APP=<app-name>"; \
		exit 1; \
	fi
	@if [ ! -d "apps/$(APP)" ]; then \
		echo "Error: App '$(APP)' not found in apps/ directory"; \
		exit 1; \
	fi
	@echo "Building Docker image for app: $(APP)"
	@docker build -t ghcr.io/toozej/tools:$(APP) --no-cache --pull --progress=plain apps/$(APP)

up: ## Run Docker Compose project with pre-built Docker images
	docker compose -f docker-compose.yml --profile build --profile runtime down --remove-orphans
	docker compose -f docker-compose.yml --profile build --profile runtime up -d

down: ## Stop running Docker Compose project
	docker compose -f docker-compose.yml --profile build --profile runtime down --remove-orphans

dev: ## Run Docker Compose project in dev mode optionally with a specific app (usage: make dev APP=namehere)
	docker compose -f docker-compose-dev.yml --profile build --profile runtime down --remove-orphans
	@if [ -z "$(APP)" ]; then \
		docker compose -f docker-compose-dev.yml --profile build --profile runtime --progress=plain build --pull; \
		docker compose -f docker-compose-dev.yml --profile build --profile runtime up; \
		exit 0; \
	fi
	@echo "Starting nginx and homepage..."
	docker compose -f docker-compose-dev.yml --profile build --profile runtime up -d www homepage
	@echo "Starting app: $(APP)"
	docker compose -f docker-compose-dev.yml --profile build --profile runtime --progress=plain build --no-cache --pull $(APP)
	docker compose -f docker-compose-dev.yml --profile build --profile runtime up  $(APP)

dev-up: ## Start running Docker Compose project in dev mode
	docker compose -f docker-compose-dev.yml --profile build --profile runtime down --remove-orphans
	docker compose -f docker-compose-dev.yml --profile build --profile runtime --progress=plain build --pull
	docker compose -f docker-compose-dev.yml --profile build --profile runtime up -d

dev-down: ## Stop running Docker Compose project in dev mode
	docker compose -f docker-compose-dev.yml --profile build --profile runtime down --remove-orphans

dev-logs: ## Show logs for dev stack (usage: make dev-logs or make dev-logs APP=<app-name>)
	@if [ -n "$(APP)" ]; then \
		docker compose -f docker-compose-dev.yml --profile build --profile runtime logs -f $(APP); \
	else \
		docker compose -f docker-compose-dev.yml --profile build --profile runtime logs -f; \
	fi

dev-nc: clean ## Run Docker Compose project in dev mode without cache optionally with a specific app (usage: make dev-nc APP=namehere)
	docker compose -f docker-compose-dev.yml --profile build --profile runtime down --remove-orphans
	@if [ -z "$(APP)" ]; then \
		rm -rf ./apps/*/.next/; rm -rf ./apps/*/dist/; rm -rf ./apps/*/node_modules/; rm -rf ./apps/*/bin/; \
		docker compose -f docker-compose-dev.yml --profile build --profile runtime --progress=plain build --no-cache --pull; \
		docker compose -f docker-compose-dev.yml --profile build --profile runtime up; \
		exit 0; \
	fi
	rm -rf ./apps/$(APP)/.next/; rm -rf ./apps/$(APP)/dist/; rm -rf ./apps/$(APP)/node_modules/; rm -rf ./apps/$(APP)/bin/;
	@echo "Starting nginx and homepage..."
	docker compose -f docker-compose-dev.yml --profile build --profile runtime up -d www homepage
	@echo "Starting app: $(APP)"
	docker compose -f docker-compose-dev.yml --profile build --profile runtime --progress=plain build --no-cache --pull $(APP)
	docker compose -f docker-compose-dev.yml --profile build --profile runtime up $(APP)

rebuild-app: ## Rebuild a specific app (usage: make rebuild-app APP=app-name)
	@if [ -z "$(APP)" ]; then \
		echo "Error: APP variable is required. Usage: make rebuild-app APP=<app-name>"; \
		exit 1; \
	fi
	@echo "Rebuilding app: $(APP)"
	@# Detect which compose file is in use by checking container labels
	$(eval COMPOSE_FILE := $(shell docker ps --filter "name=tools_" --format "{{.Names}}" 2>/dev/null | head -1 | xargs -I {} docker container inspect {} --format '{{index .Config.Labels "com.docker.compose.project.configfiles"}}' 2>/dev/null | grep -oE "docker-compose[^,]*" | head -1))
	@# Default to dev compose if no containers are running
	$(eval COMPOSE_FILE := $(if $(COMPOSE_FILE),$(COMPOSE_FILE),docker-compose-dev.yml))
	@echo "Using compose file: $(COMPOSE_FILE)"
	@# Stop the specific app container if running
	docker compose -f $(COMPOSE_FILE) --profile build --profile runtime stop $(APP) 2>/dev/null || true
	docker compose -f $(COMPOSE_FILE) --profile build --profile runtime stop $(APP) 2>/dev/null || true
	@# Remove the app containers
	docker compose -f $(COMPOSE_FILE) --profile build --profile runtime rm -f $(APP) 2>/dev/null || true
	docker compose -f $(COMPOSE_FILE) --profile build --profile runtime rm -f $(APP) 2>/dev/null || true
	@# Remove the volume for the app (for builder apps)
	docker volume rm tools_$(APP) 2>/dev/null || echo "No volume tools_$(APP) to remove"
	@# Remove the built images
	docker image rm --force tools_$(APP):latest 2>/dev/null || echo "No image tools_$(APP):latest to remove"
	docker image rm --force tools_$(APP):latest 2>/dev/null || echo "No image tools_$(APP):latest to remove"
	@# Rebuild the app with no cache and pull latest base images
	@echo "Rebuilding $(APP) with --no-cache --pull..."
	docker compose -f $(COMPOSE_FILE) --profile build --profile runtime build --no-cache --pull $(APP) 2>/dev/null || \
		docker compose -f $(COMPOSE_FILE) --profile build --profile runtime build --no-cache --pull $(APP) 2>/dev/null || \
		echo "Failed to rebuild $(APP)"
	@# Restart the www container to pick up changes
	@echo "Restarting www container..."
	docker compose -f $(COMPOSE_FILE) --profile build --profile runtime restart www
	@echo "Done rebuilding $(APP)"

pre-commit: pre-commit-install pre-commit-run ## Install and run pre-commit hooks

pre-commit-install: ## Install pre-commit hooks and necessary binaries
	command -v apt && apt-get update || echo "package manager not apt"
	# shellcheck
	command -v shellcheck || brew install shellcheck || apt install -y shellcheck || sudo dnf install -y ShellCheck || sudo apt install -y shellcheck
	# checkmake
	go install github.com/checkmake/checkmake/cmd/checkmake@latest
	# air
	go install github.com/air-verse/air@latest
	# actionlint
	command -v actionlint || brew install actionlint || go install github.com/rhysd/actionlint/cmd/actionlint@latest
	# syft
	command -v syft || curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
	# semgrep
	command -v semgrep || brew install semgrep || python3 -m pip install --break-system-packages --upgrade semgrep
	# install and update pre-commits
	# determine if on Debian 12 and if so use pip to install more modern pre-commit version
	grep --silent "VERSION=\"12 (bookworm)\"" /etc/os-release && apt install -y --no-install-recommends python3-pip && python3 -m pip install --break-system-packages --upgrade pre-commit || echo "OS is not Debian 12 bookworm"
	command -v pre-commit || brew install pre-commit || sudo dnf install -y pre-commit || sudo apt install -y pre-commit
	pre-commit install
	pre-commit autoupdate

pre-commit-run: ## Run pre-commit hooks against all files
	pre-commit run --all-files
	# manually run the following checks since their pre-commits aren't working or don't exist

clean: ## Remove any locally compiled binaries and profiles
	@rm -rf ./apps/*/.next/; rm -rf ./apps/*/dist/; rm -rf ./apps/*/node_modules/; rm -rf ./apps/*/bin/;
	@docker image rm --force $$(docker image ls --filter=reference="tools_*:latest" -q) &>/dev/null || echo "No tools_* tagged images to remove"
	@docker image rm --force $$(docker image ls | grep "<none>" | awk '{print $$3}') &>/dev/null || echo "No '<none>' images to remove"
	@docker volume rm --force $$(docker volume ls --filter=name="tools_tools_*" -q) &>/dev/null || echo "No volumes to remove"

help: ## Display help text
	@grep -E '^[a-zA-Z_-]+ ?:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
