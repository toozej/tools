#!/usr/bin/env bash
# upgrade-nextjs.sh - Safely upgrade NextJS apps with rollback capability
# Usage: ./upgrade-nextjs.sh [OPTIONS]
# Options:
#   --app <name>     Upgrade a specific app only
#   --force          Skip all confirmations (for LLM agents)
#   --next <version> Override Next.js version (default: latest)
#   --react <version> Override React version (default: latest)
# Examples:
#   ./scripts/upgrade-nextjs.sh
#   ./scripts/upgrade-nextjs.sh --app homepage
#   ./scripts/upgrade-nextjs.sh --force
#   ./scripts/upgrade-nextjs.sh --app gh-dashboard --force
#
# Rollback: Use git to rollback changes
#   git checkout -- apps/<app>/package.json apps/<app>/bun.lock

set -euo pipefail

#======================================
# CONFIGURATION
#======================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_FILE="${SCRIPT_DIR}/upgrade-$(date +%Y%m%d_%H%M%S).log"

# Flags
FORCE_MODE=false
TARGET_APP=""
NEXTJS_VERSION=""
REACT_VERSION=""

# Apps to upgrade (auto-detected by default)
APPS=()

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

#======================================
# ARGUMENT PARSING
#======================================
parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --force)
                FORCE_MODE=true
                shift
                ;;
            --app)
                if [[ -z "${2:-}" ]]; then
                    echo "Error: --app requires an app name" >&2
                    exit 1
                fi
                TARGET_APP="$2"
                shift 2
                ;;
            --next)
                if [[ -z "${2:-}" ]]; then
                    echo "Error: --next requires a version" >&2
                    exit 1
                fi
                NEXTJS_VERSION="$2"
                shift 2
                ;;
            --react)
                if [[ -z "${2:-}" ]]; then
                    echo "Error: --react requires a version" >&2
                    exit 1
                fi
                REACT_VERSION="$2"
                shift 2
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --app <name>      Upgrade a specific app only"
                echo "  --force           Skip all confirmations (for LLM agents)"
                echo "  --next <version>  Override Next.js version (default: latest)"
                echo "  --react <version> Override React version (default: latest)"
                echo "  --help, -h        Show this help message"
                exit 0
                ;;
            *)
                echo "Error: Unknown option: $1" >&2
                echo "Run '$0 --help' for usage" >&2
                exit 1
                ;;
        esac
    done
}

#======================================
# NPM REGISTRY FUNCTIONS
#======================================
get_latest_npm_version() {
    local package="$1"
    local version

    if command -v curl &> /dev/null; then
        version=$(curl -sS "https://registry.npmjs.org/${package}/latest" | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)
    elif command -v wget &> /dev/null; then
        version=$(wget -qO- "https://registry.npmjs.org/${package}/latest" | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)
    else
        echo "Error: Neither curl nor wget is available" >&2
        return 1
    fi

    if [[ -z "$version" ]]; then
        echo "Error: Could not fetch latest version for ${package}" >&2
        return 1
    fi

    echo "$version"
}

resolve_versions() {
    if [[ -z "$NEXTJS_VERSION" ]]; then
        log_info "Fetching latest Next.js version from npm registry..."
        NEXTJS_VERSION=$(get_latest_npm_version "next")
        if [[ -z "$NEXTJS_VERSION" ]]; then
            log_error "Failed to fetch Next.js version"
            exit 1
        fi
        log_info "Latest Next.js version: ${NEXTJS_VERSION}"
    fi

    if [[ -z "$REACT_VERSION" ]]; then
        log_info "Fetching latest React version from npm registry..."
        REACT_VERSION=$(get_latest_npm_version "react")
        if [[ -z "$REACT_VERSION" ]]; then
            log_error "Failed to fetch React version"
            exit 1
        fi
        log_info "Latest React version: ${REACT_VERSION}"
    fi
}

#======================================
# APP DETECTION
#======================================
detect_nextjs_apps() {
    local apps=()
    local apps_dir="apps"

    if [[ ! -d "$apps_dir" ]]; then
        log_error "apps/ directory not found. Are you running from the repo root?"
        exit 1
    fi

    for pkg_file in "$apps_dir"/*/package.json; do
        if [[ -f "$pkg_file" ]]; then
            if grep -q '"next"' "$pkg_file" 2>/dev/null; then
                local app_name
                app_name=$(dirname "$pkg_file" | xargs basename)
                apps+=("$app_name")
            fi
        fi
    done

    IFS=$'\n' sorted=($(sort <<<"${apps[*]}")); unset IFS
    echo "${sorted[@]}"
}

#======================================
# LOGGING FUNCTIONS
#======================================
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[${timestamp}] [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info()  { log "${BLUE}INFO${NC}" "$@"; }
log_success() { log "${GREEN}SUCCESS${NC}" "$@"; }
log_warn()  { log "${YELLOW}WARN${NC}" "$@"; }
log_error() { log "${RED}ERROR${NC}" "$@"; }

#======================================
# ERROR HANDLING
#======================================
cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        log_error "Script exited with error code: $exit_code"
        log_warn "Use git to rollback changes: git checkout -- apps/<app>/package.json apps/<app>/bun.lock"
    fi
    exit $exit_code
}

trap cleanup EXIT INT TERM

#======================================
# HELPER FUNCTIONS
#======================================
confirm() {
    local prompt="$1"
    local default="${2:-n}"

    if [[ "$FORCE_MODE" == "true" ]]; then
        log_info "Force mode: auto-confirming - $prompt"
        return 0
    fi

    if [[ "$default" == "y" ]]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi

    read -r -p "$prompt" response
    response="${response:-$default}"

    [[ "$response" =~ ^[Yy]$ ]]
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v bun &> /dev/null; then
        log_error "bun is not installed. Please install bun first."
        exit 1
    fi

    if ! command -v git &> /dev/null; then
        log_error "git is not installed."
        exit 1
    fi

    if ! git diff --quiet 2>/dev/null; then
        log_warn "You have uncommitted changes. Consider committing or stashing before upgrading."
        if ! confirm "Continue with uncommitted changes?" "n"; then
            exit 1
        fi
    fi

    log_success "Prerequisites check passed."
}

get_current_version() {
    local app="$1"
    local pkg="$2"
    local app_dir="apps/$app"

    if [[ -f "$app_dir/package.json" ]]; then
        if command -v jq &> /dev/null; then
            jq -r ".dependencies.${pkg} // empty" "$app_dir/package.json" 2>/dev/null || echo "unknown"
        else
            sed -n '/"dependencies"/,/^  }/p' "$app_dir/package.json" | grep -o "\"${pkg}\": *\"[^\"]*\"" | sed "s/\"${pkg}\": *\"\([^\"]*\)\"/\1/" | head -1 || echo "unknown"
        fi
    else
        echo "not-found"
    fi
}

version_matches() {
    local current="$1"
    local target="$2"

    [[ -z "$current" ]] || [[ "$current" == "unknown" ]] || [[ "$current" == "not-found" ]] && return 1

    local current_stripped="${current#^}"
    local target_stripped="${target#^}"

    [[ "$current_stripped" == "$target_stripped" ]] || [[ "$current" == "^${target_stripped}" ]]
}

update_package_json() {
    local app="$1"
    local app_dir="apps/$app"
    local pkg_file="$app_dir/package.json"

    log_info "Updating $app package.json for Next.js v${NEXTJS_VERSION}..."

    cd "$app_dir"

    bun add "next@^${NEXTJS_VERSION}" "react@^${REACT_VERSION}" "react-dom@^${REACT_VERSION}"
    bun add -d "eslint-config-next@^${NEXTJS_VERSION}"

    if grep -q '"dependencies": *"\^0\.0\.1"' package.json 2>/dev/null; then
        log_warn "Removing spurious 'dependencies' package from $app"
        bun remove dependencies 2>/dev/null || true
    fi

    cd - > /dev/null
}

verify_app() {
    local app="$1"
    local app_dir="apps/$app"
    local errors=0

    log_info "Verifying $app..."
    cd "$app_dir"

    log_info "  Running typecheck..."
    if ! bun run typecheck >> "$LOG_FILE" 2>&1; then
        log_error "  Typecheck failed for $app"
        ((errors++))
    else
        log_success "  Typecheck passed"
    fi

    log_info "  Running lint..."
    if ! bun run lint >> "$LOG_FILE" 2>&1; then
        log_error "  Lint failed for $app"
        ((errors++))
    else
        log_success "  Lint passed"
    fi

    log_info "  Running build..."
    if ! bun run build >> "$LOG_FILE" 2>&1; then
        log_error "  Build failed for $app"
        ((errors++))
    else
        log_success "  Build passed"
    fi

    cd - > /dev/null
    return $errors
}

#======================================
# MAIN EXECUTION
#======================================
main() {
    parse_args "$@"

    cd "$REPO_ROOT"

    echo ""
    echo "========================================"
    echo "  NextJS Upgrade Script"
    echo "========================================"
    echo ""

    log_info "Log file: ${LOG_FILE}"

    if [[ "$FORCE_MODE" == "true" ]]; then
        log_info "Force mode: enabled (all confirmations skipped)"
    fi

    if [[ -n "$TARGET_APP" ]]; then
        log_info "Target app: ${TARGET_APP}"
    fi

    echo ""

    resolve_versions

    echo ""
    log_info "Target Next.js version: ${NEXTJS_VERSION}"
    log_info "Target React version: ${REACT_VERSION}"
    echo ""

    if [[ -n "$TARGET_APP" ]]; then
        if [[ ! -d "apps/$TARGET_APP" ]]; then
            log_error "App not found: apps/$TARGET_APP"
            exit 1
        fi
        if [[ ! -f "apps/$TARGET_APP/package.json" ]]; then
            log_error "No package.json found in apps/$TARGET_APP"
            exit 1
        fi
        if ! grep -q '"next"' "apps/$TARGET_APP/package.json" 2>/dev/null; then
            log_error "apps/$TARGET_APP is not a NextJS app"
            exit 1
        fi
        APPS=("$TARGET_APP")
        log_info "Targeting specific app: ${TARGET_APP}"
    else
        log_info "Auto-detecting NextJS apps..."
        detected_apps=$(detect_nextjs_apps)
        if [[ -z "$detected_apps" ]]; then
            log_error "No NextJS apps found in apps/ directory"
            exit 1
        fi
        IFS=' ' read -ra APPS <<< "$detected_apps"
        log_info "Detected ${#APPS[@]} NextJS apps: ${APPS[*]}"
    fi
    echo ""

    log_info "Current versions:"
    local apps_to_process=()
    local skipped_apps=()

    for app in "${APPS[@]}"; do
        current_next=$(get_current_version "$app" "next")
        current_react=$(get_current_version "$app" "react")
        log_info "  $app: Next.js $current_next, React $current_react"

        if version_matches "$current_next" "$NEXTJS_VERSION" && version_matches "$current_react" "$REACT_VERSION"; then
            skipped_apps+=("$app")
        else
            apps_to_process+=("$app")
        fi
    done
    echo ""

    if [[ ${#apps_to_process[@]} -eq 0 ]]; then
        log_success "All apps already at Next.js v${NEXTJS_VERSION}, React v${REACT_VERSION}"
        exit 0
    fi

    if [[ ${#skipped_apps[@]} -gt 0 ]]; then
        log_info "Skipping ${#skipped_apps[@]} apps already at target versions: ${skipped_apps[*]}"
        echo ""
    fi

    if ! confirm "Proceed with upgrade of ${#apps_to_process[@]} apps to Next.js v${NEXTJS_VERSION}?" "n"; then
        log_info "Aborted by user."
        exit 0
    fi

    check_prerequisites

    echo ""
    log_info "=== Phase 1: Update Dependencies ==="
    local failed_apps=()

    for app in "${apps_to_process[@]}"; do
        log_info "Processing $app..."
        cd "apps/$app"

        rm -rf node_modules .next bun.lock 2>/dev/null || true

        cd - > /dev/null
        update_package_json "$app"
        cd "apps/$app"

        log_info "  Installing dependencies..."
        if ! bun install >> "$LOG_FILE" 2>&1; then
            log_error "  Failed to install dependencies for $app"
            failed_apps+=("$app")
        fi

        cd - > /dev/null
    done

    if [[ ${#failed_apps[@]} -gt 0 ]]; then
        log_error "Failed to install dependencies for: ${failed_apps[*]}"
        if ! confirm "Some apps failed. Continue with verification?" "n"; then
            exit 1
        fi
    fi

    echo ""
    log_info "=== Phase 2: Verification ==="
    local verification_failed=()

    for app in "${apps_to_process[@]}"; do
        if ! verify_app "$app"; then
            verification_failed+=("$app")
        fi
    done

    echo ""
    echo "========================================"
    echo "  UPGRADE SUMMARY"
    echo "========================================"

    if [[ ${#verification_failed[@]} -eq 0 ]]; then
        if [[ ${#skipped_apps[@]} -gt 0 ]]; then
            log_info "Skipped ${#skipped_apps[@]} apps already at target versions: ${skipped_apps[*]}"
        fi
        if [[ ${#apps_to_process[@]} -gt 0 ]]; then
            log_success "Upgraded ${#apps_to_process[@]} apps to Next.js v${NEXTJS_VERSION}!"
        else
            log_success "All apps already at target versions."
        fi
        log_info "Log file: $LOG_FILE"
        echo ""
        log_info "Next steps:"
        echo "  1. Run 'bun run dev' in each app to test manually"
        echo "  2. Commit changes: git add . && git commit -m 'chore: upgrade Next.js to v${NEXTJS_VERSION}'"
    else
        log_error "Verification failed for: ${verification_failed[*]}"
        log_warn "Check log file for details: $LOG_FILE"
        echo ""
        log_info "To rollback failed apps:"
        for app in "${verification_failed[@]}"; do
            echo "  git checkout -- apps/$app/package.json apps/$app/bun.lock"
        done
        exit 1
    fi
}

main "$@"
