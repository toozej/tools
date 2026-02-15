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

.PHONY: all test build run up down dev dev-nc local pre-commit-install pre-commit-run pre-commit pre-reqs clean rebuild-app help

all: clean up ## Run default workflow via Docker
local: pre-commit dev-nc ## Run dev workflow using Docker
pre-reqs: pre-commit-install ## Install pre-commit hooks and necessary binaries

test: ## Nothing
	echo "Tests are run during Docker build process"

build: ## Build artifacts Docker images
	docker compose --profile build up --build

up: ## Run Docker Compose project with pre-built Docker images
	docker compose -f docker-compose.yml --profile build --profile runtime down --remove-orphans
	docker compose -f docker-compose.yml --profile build --profile runtime up -d

down: ## Stop running Docker Compose project
	docker compose -f docker-compose.yml --profile build --profile runtime down --remove-orphans

dev: ## Run Docker Compose project in dev mode
	docker compose -f docker-compose-dev.yml --profile build --profile runtime down --remove-orphans
	docker compose -f docker-compose-dev.yml --profile build --profile runtime --progress=plain build --pull
	docker compose -f docker-compose-dev.yml --profile build --profile runtime up
	docker compose -f docker-compose-dev.yml --profile build --profile runtime down --remove-orphans

dev-down: ## Stop running Docker Compose project in dev mode
	docker compose -f docker-compose-dev.yml --profile build --profile runtime down --remove-orphans

dev-nc: clean ## Run Docker Compose project in dev mode without cache
	docker compose -f docker-compose-dev.yml --profile build --profile runtime down --remove-orphans
	rm -rf ./apps/*/.next/; rm -rf ./apps/*/dist/; rm -rf ./apps/*/node_modules/; rm -rf ./apps/*/bin/;
	docker compose -f docker-compose-dev.yml --profile build --profile runtime --progress=plain build --no-cache --pull
	docker compose -f docker-compose-dev.yml --profile build --profile runtime up

pre-commit: pre-commit-install pre-commit-run ## Install and run pre-commit hooks

pre-commit-install: ## Install pre-commit hooks and necessary binaries
	command -v apt && apt-get update || echo "package manager not apt"
	# shellcheck
	command -v shellcheck || brew install shellcheck || apt install -y shellcheck || sudo dnf install -y ShellCheck || sudo apt install -y shellcheck
	# checkmake
	go install github.com/checkmake/checkmake/cmd/checkmake@latest
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
	@docker image rm --force $$(docker image ls --filter=reference="tools_*:latest" -q) &>/dev/null || echo "No tools_* tagged images to remove"
	@docker image rm --force $$(docker image ls | grep "<none>" | awk '{print $$3}') &>/dev/null || echo "No '<none>' images to remove"
	@docker volume rm --force $$(docker volume ls --filter=name="tools_tools_*" -q) &>/dev/null || echo "No volumes to remove"

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
	docker compose -f $(COMPOSE_FILE) stop $(APP) 2>/dev/null || true
	docker compose -f $(COMPOSE_FILE) stop $(APP)-builder 2>/dev/null || true
	@# Remove the app containers
	docker compose -f $(COMPOSE_FILE) rm -f $(APP) 2>/dev/null || true
	docker compose -f $(COMPOSE_FILE) rm -f $(APP)-builder 2>/dev/null || true
	@# Remove the volume for the app (for builder apps)
	docker volume rm tools_$(APP) 2>/dev/null || echo "No volume tools_$(APP) to remove"
	@# Remove the built images
	docker image rm --force tools_$(APP):latest 2>/dev/null || echo "No image tools_$(APP):latest to remove"
	docker image rm --force tools_$(APP)-builder:latest 2>/dev/null || echo "No image tools_$(APP)-builder:latest to remove"
	@# Rebuild the app with no cache and pull latest base images
	@echo "Rebuilding $(APP) with --no-cache --pull..."
	docker compose -f $(COMPOSE_FILE) build --no-cache --pull $(APP) 2>/dev/null || \
		docker compose -f $(COMPOSE_FILE) --profile build --profile runtime build --no-cache --pull $(APP)-builder 2>/dev/null || \
		docker compose -f $(COMPOSE_FILE) --profile build --profile runtime build --no-cache --pull $(APP) 2>/dev/null || echo "Failed to rebuild $(APP)"
	@# Restart the www container to pick up changes
	@echo "Restarting www container..."
	docker compose -f $(COMPOSE_FILE) --profile build --profile runtime restart www
	@echo "Done rebuilding $(APP)"

help: ## Display help text
	@grep -E '^[a-zA-Z_-]+ ?:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
