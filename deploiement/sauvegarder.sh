#!/usr/bin/env bash
# Sauvegarde quotidienne de l'app-coaching (app-coaching-sauvegarde.timer, en root).
# 1. app.db : copie cohérente via VACUUM INTO (node:sqlite) + integrity_check, même si le serveur tourne.
# 2. fichiers/ (photos, PDF) : archive tar.gz.
# 3. Garde 14 jours dans /var/lib/app-coaching/sauvegardes.
main() {
set -euo pipefail
D=/var/lib/app-coaching
DB=$D/app.db
FICHIERS=$D/fichiers
OUT=$D/sauvegardes
ETAT=$D/derniere-sauvegarde.txt
JOUR=$(date +%F)
F=$OUT/app-$JOUR.db
umask 077
[ -f "$DB" ] || { echo "Pas encore de base ($DB) : rien à sauvegarder."; return 0; }
install -d -o appcoaching -g appcoaching -m 0700 "$OUT"
rm -f "$F" "$F.gz" "$OUT/fichiers-$JOUR.tar.gz"
sudo -u appcoaching node -e '
const { DatabaseSync } = require("node:sqlite");
const [src, dst] = process.argv.slice(1);
const d = new DatabaseSync(src);
d.exec("VACUUM INTO \x27" + dst.replace(/\x27/g, "") + "\x27");
d.close();
const c = new DatabaseSync(dst);
const r = c.prepare("PRAGMA integrity_check").get();
c.close();
if (Object.values(r)[0] !== "ok") { console.error("copie corrompue"); process.exit(1); }
' "$DB" "$F" || { echo "ECHEC $(date '+%F %H:%M') : copie de la base" | tee "$ETAT"; rm -f "$F"; return 1; }
gzip -f "$F"
NF=0
if [ -d "$FICHIERS" ]; then
  sudo -u appcoaching tar -czf "$OUT/fichiers-$JOUR.tar.gz" -C "$D" fichiers
  NF=$(find "$FICHIERS" -type f | wc -l)
fi
chown -R appcoaching:appcoaching "$OUT"
find "$OUT" \( -name 'app-*.db.gz' -o -name 'fichiers-*.tar.gz' \) -mtime +14 -delete
echo "OK $(date '+%F %H:%M') · base $(du -h "$F.gz" | cut -f1) · $NF fichiers · 14 jours conservés (copie hors VPS : non configurée)" | tee "$ETAT"
}
main "$@"
exit
