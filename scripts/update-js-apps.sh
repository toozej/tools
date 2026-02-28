#!/usr/bin/env bash
# update-js-apps.sh - Update JavaScript/TypeScript apps to latest package versions
# Usage: ./update-js-apps.sh [OPTIONS]
# Options:
#   --app <name>     Update a specific app only
#   --force          Skip all confirmations (for LLM agents)
#   --dry-run        Show what would be updated without making changes
# Examples:
#   ./scripts/update-js-apps.sh
#   ./scripts/update-js-apps.sh --app homepage
#   ./scripts/update-js-apps.sh --force
#   ./scripts/update-js-apps.sh --app gh-dashboard --dry-run
#
# Rollback: Use git to rollback changes
#   git checkout -- apps/<app>/package.json apps/<app>/bun.lock

set -euo pipefail

#======================================
# CONFIGURATION
#======================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_FILE="${SCRIPT_DIR}/update-$(date +%Y%m%d_%H%M%S).log"

# Flags
FORCE_MODE=false
TARGET_APP=""
DRY_RUN=false

# Apps to update (auto-detected by default)
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
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --app <name>      Update a specific app only"
                echo "  --force           Skip all confirmations (for LLM agents)"
                echo "  --dry-run         Show what would be updated without making changes"
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
# APP DETECTION
#======================================
detect_js_apps() {
    local apps=()
    local apps_dir="apps"

    if [[ ! -d "$apps_dir" ]]; then
        log_error "apps/ directory not found. Are you running from the repo root?"
        exit 1
    fi

    for pkg_file in "$apps_dir"/*/package.json; do
        if [[ -f "$pkg_file" ]]; then
            local app_name
            app_name=$(dirname "$pkg_file" | xargs basename)
            apps+=("$app_name")
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
        log_warn "You have uncommitted changes. Consider committing or stashing before updating."
        if ! confirm "Continue with uncommitted changes?" "n"; then
            exit 1
        fi
    fi

    log_success "Prerequisites check passed."
}

get_package_versions() {
    local app="$1"
    local app_dir="apps/$app"

    if [[ -f "$app_dir/package.json" ]]; then
        local deps_count
        deps_count=$(jq -r '.dependencies | if . then keys | length else 0 end' "$app_dir/package.json" 2>/dev/null || echo "0")
        local dev_deps_count
        dev_deps_count=$(jq -r '.devDependencies | if . then keys | length else 0 end' "$app_dir/package.json" 2>/dev/null || echo "0")
        echo "dependencies: $deps_count, devDependencies: $dev_deps_count"
    else
        echo "not-found"
    fi
}

update_app() {
    local app="$1"
    local app_dir="apps/$app"

    log_info "Updating $app..."

    cd "$app_dir"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "  [DRY RUN] Would run: bun update"
        bun update --dry-run 2>&1 | while read -r line; do
            log_info "    $line"
        done
    else
        log_info "  Running: bun update"
        if ! bun update >> "$LOG_FILE" 2>&1; then
            log_error "  Failed to update $app"
            cd - > /dev/null
            return 1
        fi
        log_success "  Updated $app"
    fi

    cd - > /dev/null
    return 0
}

verify_app() {
    local app="$1"
    local app_dir="apps/$app"

    # Check if package.json still exists
    if [[ ! -f "$app_dir/package.json" ]]; then
        log_error "package.json not found for $app"
        return 1
    fi

    # Check if bun.lock exists and try to install
    cd "$app_dir"

    log_info "  Running: bun install"
    if ! bun install >> "$LOG_FILE" 2>&1; then
        log_error "  Failed to install dependencies for $app"
        cd - > /dev/null
        return 1
    fi

    # Try to run typecheck if available
    if grep -q '"typecheck"' "package.json" 2>/dev/null; then
        log_info "  Running typecheck..."
        if ! bun run typecheck >> "$LOG_FILE" 2>&1; then
            log_warn "  Typecheck failed for $app"
        fi
    fi

    # Try to run lint if available
    if grep -q '"lint"' "package.json" 2>/dev/null; then
        log_info "  Running lint..."
        if ! bun run lint >> "$LOG_FILE" 2>&1; then
            log_warn "  Lint failed for $app"
        fi
    fi

    cd - > /dev/null
    return 0
}

#======================================
# MAIN EXECUTION
#======================================
main() {
    parse_args "$@"

    cd "$REPO_ROOT"

    echo ""
    echo "========================================"
    echo "  JavaScript Apps Update Script"
    echo "========================================"
    echo ""

    log_info "Log file: ${LOG_FILE}"

    if [[ "$FORCE_MODE" == "true" ]]; then
        log_info "Force mode: enabled (all confirmations skipped)"
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Dry run mode: enabled (no changes will be made)"
    fi

    if [[ -n "$TARGET_APP" ]]; then
        log_info "Target app: ${TARGET_APP}"
    fi

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
        APPS=("$TARGET_APP")
        log_info "Targeting specific app: ${TARGET_APP}"
    else
        log_info "Auto-detecting JavaScript apps..."
        detected_apps=$(detect_js_apps)
        if [[ -z "$detected_apps" ]]; then
            log_error "No JavaScript apps found in apps/ directory"
            exit 1
        fi
        IFS=' ' read -ra APPS <<< "$detected_apps"
        log_info "Detected ${#APPS[@]} JavaScript apps: ${APPS[*]}"
    fi
    echo ""

    log_info "Apps to update:"
    for app in "${APPS[@]}"; do
        local pkg_info
        pkg_info=$(get_package_versions "$app")
        log_info "  - $app ($pkg_info)"
    done
    echo ""

    if ! confirm "Proceed with updating ${#APPS[@]} apps?" "n"; then
        log_info "Aborted by user."
        exit 0
    fi

    check_prerequisites

    echo ""
    log_info "=== Phase 1: Update Dependencies ==="
    local failed_apps=()

    for app in "${APPS[@]}"; do
        if ! update_app "$app"; then
            failed_apps+=("$app")
        fi
    done

    if [[ ${#failed_apps[@]} -gt 0 ]]; then
        log_error "Failed to update: ${failed_apps[*]}"
        if ! confirm "Some apps failed. Continue with verification?" "n"; then
            exit 1
        fi
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        echo ""
        log_info "Dry run complete. No changes were made."
        exit 0
    fi

    echo ""
    log_info "=== Phase 2: Verification ==="
    local verification_failed=()

    for app in "${APPS[@]}"; do
        if ! verify_app "$app"; then
            verification_failed+=("$app")
        fi
    done

    echo ""
    echo "========================================"
    echo "  UPDATE SUMMARY"
    echo "========================================"

    if [[ ${#verification_failed[@]} -eq 0 ]]; then
        log_success "Successfully updated ${#APPS[@]} apps!"
        log_info "Log file: $LOG_FILE"
        echo ""
        log_info "Next steps:"
        echo "  1. Run 'bun run dev' in each app to test manually"
        echo "  2. Commit changes: git add . && git commit -m 'chore: update JS packages'"
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
