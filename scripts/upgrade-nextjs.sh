#!/usr/bin/env bash
# upgrade-nextjs.sh - Safely upgrade NextJS apps with rollback capability
# Usage: ./upgrade-nextjs.sh [VERSION]
# Example: ./upgrade-nextjs.sh 16.1.3

set -euo pipefail

#======================================
# CONFIGURATION
#======================================
NEXTJS_VERSION="${1:-16.1.3}"
REACT_VERSION="${2:-19.2.3}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/upgrade-$(date +%Y%m%d_%H%M%S).log"
BACKUP_DIR="${SCRIPT_DIR}/.upgrade-backup-$(date +%Y%m%d_%H%M%S)"

# Apps to upgrade (space-separated, or auto-detect)
APPS=("clip2gist" "gh-dashboard" "unit-converter" "www2epub" "www2s" "yaml-formatter")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
        log_warn "Backups preserved at: $BACKUP_DIR"
        log_warn "To rollback, run: ./rollback-upgrade.sh $BACKUP_DIR"
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

    if [[ "$default" == "y" ]]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi

    read -r -p "$prompt" response
    response="${response:-$default}"

    [[ "$response" =~ ^[Yy]$ ]]
}

backup_app() {
    local app="$1"
    local app_dir="apps/$app"

    if [[ -d "$app_dir" ]]; then
        log_info "Backing up $app..."
        mkdir -p "$BACKUP_DIR/$app"
        cp "$app_dir/package.json" "$BACKUP_DIR/$app/"
        [[ -f "$app_dir/bun.lock" ]] && cp "$app_dir/bun.lock" "$BACKUP_DIR/$app/"
        [[ -f "$app_dir/next.config.ts" ]] && cp "$app_dir/next.config.ts" "$BACKUP_DIR/$app/"
        [[ -f "$app_dir/next.config.js" ]] && cp "$app_dir/next.config.js" "$BACKUP_DIR/$app/"
    fi
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check bun
    if ! command -v bun &> /dev/null; then
        log_error "bun is not installed. Please install bun first."
        exit 1
    fi

    # Check git
    if ! command -v git &> /dev/null; then
        log_error "git is not installed."
        exit 1
    fi

    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        log_warn "You have uncommitted changes."
        if ! confirm "Continue anyway?" "n"; then
            log_info "Aborted by user."
            exit 0
        fi
    fi

    log_success "Prerequisites check passed."
}

get_current_version() {
    local app="$1"
    local app_dir="apps/$app"

    if [[ -f "$app_dir/package.json" ]]; then
        grep -o '"next": *"[^"]*"' "$app_dir/package.json" | sed 's/"next": *"\([^"]*\)"/\1/' || echo "unknown"
    else
        echo "not-found"
    fi
}

update_package_json() {
    local app="$1"
    local app_dir="apps/$app"
    local pkg_file="$app_dir/package.json"

    log_info "Updating $app package.json for Next.js v${NEXTJS_VERSION}..."

    # Use bun to update dependencies
    cd "$app_dir"

    # Update core dependencies
    bun add "next@^${NEXTJS_VERSION}" "react@^${REACT_VERSION}" "react-dom@^${REACT_VERSION}"

    # Update dev dependencies
    bun add -d "eslint-config-next@^${NEXTJS_VERSION}"

    # Remove spurious "dependencies" package if present
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

    # Type check
    log_info "  Running typecheck..."
    if ! bun run typecheck >> "$LOG_FILE" 2>&1; then
        log_error "  Typecheck failed for $app"
        ((errors++))
    else
        log_success "  Typecheck passed"
    fi

    # Lint
    log_info "  Running lint..."
    if ! bun run lint >> "$LOG_FILE" 2>&1; then
        log_error "  Lint failed for $app"
        ((errors++))
    else
        log_success "  Lint passed"
    fi

    # Build
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
    echo ""
    echo "========================================"
    echo "  NextJS Upgrade Script"
    echo "========================================"
    echo ""
    log_info "Target Next.js version: ${NEXTJS_VERSION}"
    log_info "Target React version: ${REACT_VERSION}"
    log_info "Log file: ${LOG_FILE}"
    echo ""

    # Show current state
    log_info "Current versions:"
    for app in "${APPS[@]}"; do
        current=$(get_current_version "$app")
        log_info "  $app: Next.js $current"
    done
    echo ""

    # Confirm before proceeding
    if ! confirm "Proceed with upgrade of ${#APPS[@]} apps to Next.js v${NEXTJS_VERSION}?" "n"; then
        log_info "Aborted by user."
        exit 0
    fi

    check_prerequisites

    # Phase 1: Backup
    echo ""
    log_info "=== Phase 1: Backup ==="
    for app in "${APPS[@]}"; do
        backup_app "$app"
    done
    log_success "Backups created at: $BACKUP_DIR"

    # Phase 2: Update dependencies
    echo ""
    log_info "=== Phase 2: Update Dependencies ==="
    local failed_apps=()

    for app in "${APPS[@]}"; do
        log_info "Processing $app..."
        cd "apps/$app"

        # Clean
        rm -rf node_modules .next bun.lock 2>/dev/null || true

        # Update package.json
        cd - > /dev/null
        update_package_json "$app"
        cd "apps/$app"

        # Install
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

    # Phase 3: Verify
    echo ""
    log_info "=== Phase 3: Verification ==="
    local verification_failed=()

    for app in "${APPS[@]}"; do
        if ! verify_app "$app"; then
            verification_failed+=("$app")
        fi
    done

    # Summary
    echo ""
    echo "========================================"
    echo "  UPGRADE SUMMARY"
    echo "========================================"

    if [[ ${#verification_failed[@]} -eq 0 ]]; then
        log_success "All apps upgraded successfully to Next.js v${NEXTJS_VERSION}!"
        log_info "Backups preserved at: $BACKUP_DIR"
        log_info "Log file: $LOG_FILE"
        echo ""
        log_info "Next steps:"
        echo "  1. Run 'bun run dev' in each app to test manually"
        echo "  2. Commit changes: git add . && git commit -m 'chore: upgrade Next.js to v${NEXTJS_VERSION}'"
        echo "  3. Remove backups if satisfied: rm -rf $BACKUP_DIR"
    else
        log_error "Verification failed for: ${verification_failed[*]}"
        log_warn "Backups available at: $BACKUP_DIR"
        log_warn "Check log file for details: $LOG_FILE"
        echo ""
        log_info "To rollback failed apps:"
        for app in "${verification_failed[@]}"; do
            echo "  cp $BACKUP_DIR/$app/package.json apps/$app/"
        done
        exit 1
    fi
}

# Run main
main "$@"
