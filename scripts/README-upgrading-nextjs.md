# Upgrade to Next.js 16.1.3 (default)
./scripts/upgrade-nextjs.sh

# Upgrade to a specific version
./scripts/upgrade-nextjs.sh 17.0.0

# Upgrade with custom React version
./scripts/upgrade-nextjs.sh 17.0.0 20.0.0

# Rollback if needed
./scripts/rollback-nextjs-upgrade.sh .upgrade-backup-20260213_100000

