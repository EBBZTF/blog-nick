#!/usr/bin/env bash
# Backs up the content of the website (data/) away from the SD card.
#
# The card in a Pi eventually fails — data/backups/ sits on that same card and
# is no help then. This script writes a dated snapshot and optionally pushes it
# to another machine.
#
#   ./deploy/backup-content.sh                         # local only (/home/pi/backups)
#   ./deploy/backup-content.sh pi@nas:/backups/website # additionally via rsync

set -euo pipefail

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$PROJECT/data"
LOCAL="${BACKUP_DIR:-$HOME/backups/nickberdi}"
KEEP="${BACKUP_KEEP:-30}"
TARGET="${1:-}"

[ -d "$SOURCE" ] || { echo "data/ not found: $SOURCE" >&2; exit 1; }

mkdir -p "$LOCAL"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
ARCHIVE="$LOCAL/data-$STAMP.tar.gz"

# Uploaded images are excluded on purpose: they would sit in all $KEEP
# archives and blow the backup up from kilobytes to hundreds of megabytes.
# They are pushed to the target incrementally further down instead.
tar -czf "$ARCHIVE" --exclude="data/uploads" -C "$PROJECT" data
echo "Backed up: $ARCHIVE"

# Clear out old snapshots, the last $KEEP are kept.
ls -1t "$LOCAL"/data-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
	rm -f "$old"
	echo "Removed: $old"
done

if [ -n "$TARGET" ]; then
	rsync -a "$ARCHIVE" "$TARGET/"
	echo "Copied to: $TARGET"

	# Images separately and incrementally: only what is new goes over the wire,
	# and one copy is enough because the files never change under their name.
	if [ -d "$SOURCE/uploads" ]; then
		rsync -a --delete "$SOURCE/uploads/" "$TARGET/uploads/"
		echo "Images synced to: $TARGET/uploads/"
	fi
fi
