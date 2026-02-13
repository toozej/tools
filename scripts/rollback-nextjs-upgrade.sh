#!/usr/bin/env bash
# rollback-upgrade.sh - Rollback from a failed upgrade
# Usage: ./rollback-upgrade.sh <backup-dir>

set -euo pipefail

BACKUP_DIR="${1:-}"

if [[ -z "$BACKUP_DIR" ]] || [[ ! -d "$BACKUP_DIR" ]]; then
    echo "Usage: $0 <backup-dir>"
    echo "Available backups:"
    ls -d .upgrade-backup-* 2>/dev/null || echo "  No backups found"
    exit 1
fi

echo "Rolling back from: $BACKUP_DIR"

for app_dir in "$BACKUP_DIR"/*/; do
    app=$(basename "$app_dir")
    if [[ -d "apps/$app" ]]; then
        echo "Restoring $app..."
        cp "$app_dir/package.json" "apps/$app/"
        [[ -f "$app_dir/bun.lock" ]] && cp "$app_dir/bun.lock" "apps/$app/"
        cd "apps/$app"
        rm -rf node_modules .next
        bun install
        cd - > /dev/null
    fi
done

echo "Rollback complete."
