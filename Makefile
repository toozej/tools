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

.PHONY: all test build run up down dev dev-nc local pre-commit-install pre-commit-run pre-commit pre-reqs clean help

all: clean up ## Run default workflow via Docker
local: pre-commit dev-nc ## Run dev workflow using Docker
pre-reqs: pre-commit-install ## Install pre-commit hooks and necessary binaries

test: ## Nothing
	echo "Tests are run during Docker build process"

build: ## Build artifacts Docker images
	docker compose --profile build up --build

up: ## Run Docker Compose project with build Docker image
	docker compose -f docker-compose.yml --profile build --profile runtime down --remove-orphans
	docker compose -f docker-compose.yml --profile build --profile runtime up --build -d

down: ## Stop running Docker Compose project
	docker compose -f docker-compose.yml --profile build --profile runtime down --remove-orphans

dev: ## Run Docker Compose project in dev mode
	docker compose -f docker-compose-example.yml --profile build --profile runtime down --remove-orphans
	docker compose -f docker-compose-example.yml --profile build --profile runtime build
	docker compose -f docker-compose-example.yml --profile build --profile runtime up
	docker compose -f docker-compose-example.yml --profile build --profile runtime down --remove-orphans

dev-down: ## Stop running Docker Compose project in dev mode
	docker compose -f docker-compose-example.yml --profile build --profile runtime down --remove-orphans

dev-nc: clean ## Run Docker Compose project in dev mode without cache
	docker compose -f docker-compose-example.yml --profile build --profile runtime down --remove-orphans
	docker compose -f docker-compose-example.yml --profile build --profile runtime build --no-cache --pull
	docker compose -f docker-compose-example.yml --profile build --profile runtime up

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
	docker image rm --force $$(docker image ls --filter=reference="tools_*:latest" -q) || echo "No images to remove"
	docker volume rm --force $$(docker volume ls --filter=name="tools_*:latest" -q) || echo "No volumes to remove"

help: ## Display help text
	@grep -E '^[a-zA-Z_-]+ ?:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
