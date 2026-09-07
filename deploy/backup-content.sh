#!/usr/bin/env bash
# Sichert den Inhalt der Website (data/) weg von der SD-Karte.
#
# Die Karte in einer Pi geht irgendwann kaputt — data/backups/ liegt auf
# derselben Karte und hilft dann nicht. Dieses Skript legt einen datierten
# Schnappschuss an und schiebt ihn optional auf ein anderes Gerät.
#
#   ./deploy/backup-content.sh                         # nur lokal (/home/pi/backups)
#   ./deploy/backup-content.sh pi@nas:/backups/website # zusätzlich per rsync

set -euo pipefail

PROJEKT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
QUELLE="$PROJEKT/data"
LOKAL="${BACKUP_DIR:-$HOME/backups/nickberdi}"
BEHALTEN="${BACKUP_KEEP:-30}"
ZIEL="${1:-}"

[ -d "$QUELLE" ] || { echo "data/ nicht gefunden: $QUELLE" >&2; exit 1; }

mkdir -p "$LOKAL"
STEMPEL="$(date +%Y-%m-%d_%H%M%S)"
ARCHIV="$LOKAL/data-$STEMPEL.tar.gz"

tar -czf "$ARCHIV" -C "$PROJEKT" data
echo "Gesichert: $ARCHIV"

# Alte Schnappschüsse aufräumen, die letzten $BEHALTEN bleiben liegen.
ls -1t "$LOKAL"/data-*.tar.gz 2>/dev/null | tail -n +$((BEHALTEN + 1)) | while read -r alt; do
	rm -f "$alt"
	echo "Entfernt: $alt"
done

if [ -n "$ZIEL" ]; then
	rsync -a "$ARCHIV" "$ZIEL/"
	echo "Kopiert nach: $ZIEL"
fi
