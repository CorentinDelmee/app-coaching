#!/usr/bin/env bash
# Sauvegarde quotidienne de l'app-coaching (app-coaching-sauvegarde.timer, en utilisateur appcoaching, UMask 0077).
# 1. app.db : copie cohérente via VACUUM INTO (node:sqlite) + integrity_check, même si le serveur tourne.
# 2. fichiers/ (photos, PDF) : archive tar.gz.
# 3. Chiffrement age si BACKUP_AGE_RECIPIENT (clé PUBLIQUE « age1… ») est défini dans /etc/app-coaching.env ;
#    la clé privée reste sur le Mac de Corentin (jamais sur le VPS). Sinon : avertissement dans le journal.
# 4. Garde 14 jours dans /var/lib/app-coaching/sauvegardes. La copie hors VPS est faite par Corentin (LISEZMOI).
main() {
set -euo pipefail
umask 077
D=/var/lib/app-coaching
DB=$D/app.db
FICHIERS=$D/fichiers
OUT=$D/sauvegardes
ETAT=$D/derniere-sauvegarde.txt
JOUR=$(date +%F)
F=$OUT/app-$JOUR.db
DEST=${BACKUP_AGE_RECIPIENT:-}
[ -f "$DB" ] || { echo "Pas encore de base ($DB) : rien à sauvegarder."; return 0; }
mkdir -p "$OUT"
chmod 0700 "$OUT"

# Chiffrer (age) ou seulement compresser : lit l'entrée standard, écrit dans $1.
if [ -n "$DEST" ]; then
  command -v age >/dev/null || { echo "ECHEC $(date '+%F %H:%M') : BACKUP_AGE_RECIPIENT défini mais age absent (apt install age)" | tee "$ETAT"; return 1; }
  case "$DEST" in age1*) ;; *) echo "ECHEC $(date '+%F %H:%M') : BACKUP_AGE_RECIPIENT doit être une clé publique age1…" | tee "$ETAT"; return 1;; esac
  EXT=.age
  ecrire() { age -r "$DEST" -o "$1"; }
else
  echo "ATTENTION : sauvegardes NON chiffrées (BACKUP_AGE_RECIPIENT absent de /etc/app-coaching.env), voir LISEZMOI." >&2
  EXT=
  ecrire() { cat > "$1"; }
fi
rm -f "$F" "$F.gz$EXT" "$OUT/fichiers-$JOUR.tar.gz$EXT"
node -e '
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
gzip -c "$F" | ecrire "$F.gz$EXT" || { rm -f "$F" "$F.gz$EXT"; echo "ECHEC $(date '+%F %H:%M') : compression/chiffrement" | tee "$ETAT"; return 1; }
rm -f "$F" # la copie en clair ne reste pas sur le disque
NF=0
if [ -d "$FICHIERS" ]; then
  tar -czf - -C "$D" fichiers | ecrire "$OUT/fichiers-$JOUR.tar.gz$EXT"
  NF=$(find "$FICHIERS" -type f | wc -l)
fi
find "$OUT" \( -name 'app-*.db.gz*' -o -name 'fichiers-*.tar.gz*' \) -mtime +14 -delete
echo "OK $(date '+%F %H:%M') · base $(du -h "$F.gz$EXT" | cut -f1) · $NF fichiers · $([ -n "$EXT" ] && echo chiffrée || echo 'NON chiffrée') · 14 jours conservés (copie hors VPS : à faire par Corentin)" | tee "$ETAT"
}
main "$@"
exit
