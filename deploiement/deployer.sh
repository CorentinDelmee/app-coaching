#!/usr/bin/env bash
# Met en ligne la dernière version de l'app-coaching (lancé en root sur le VPS) : serveur + PWA + bloc Caddy.
# Étapes : essai sur une copie (npm ci + tests serveur + build VITE_BACKEND=api) → git merge --ff-only
# → npm ci --omit=dev → dist/ copié dans un dossier neuf puis échangé d'un coup → redémarrage → vérification.
# Si la vérification échoue : retour à la version précédente (code + site).
# Tout est dans main() : un git pull qui modifie ce fichier pendant qu'il tourne ne le casse pas.
main() {
set -euo pipefail
APP_USER=appcoaching
APP_DIR=/var/www/app-coaching
DEPOT=$APP_DIR/depot
ESSAI=$APP_DIR/essai
ENV_FILE=/etc/app-coaching.env
CADDY_BLOC=/etc/caddy/sites/app-coaching.caddy

[ "$(id -u)" -eq 0 ] || { echo "À lancer en root."; exit 1; }
[ -d "$DEPOT/.git" ] || { echo "Dépôt absent : lancer d'abord installer.sh."; exit 1; }
[ -f "$ENV_FILE" ] || { echo "Il manque $ENV_FILE : lancer installer.sh."; exit 1; }

# Lecture d'une valeur du fichier de secrets sans l'exécuter (jamais de « source » sur des secrets)
lire() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | tr -d '"'"'"'\r'; }
for V in SESSION_SECRET COACH_API_KEY RESA_API_URL RESA_ADMIN_KEY APP_ORIGIN DB_FILE FICHIERS_DIR; do
  [ -n "$(lire "$V")" ] || { echo "$V est vide dans $ENV_FILE : le remplir (nano $ENV_FILE)."; exit 1; }
done
case "$(lire APP_ORIGIN)" in https://app.*) ;; *) echo "APP_ORIGIN doit être https://app.<domaine>."; exit 1;; esac
DOMAINE=$(lire APP_ORIGIN | sed -e 's#^https://app\.##' -e 's#/*$##')
# Les deux clés RESA_ADMIN_KEY doivent être identiques (sinon l'écran Réservations répond 502)
CLE_RESA=$(sed -n 's/^RESA_ADMIN_KEY=//p' /etc/coaching-resa.env 2>/dev/null | tail -n 1 | tr -d '"'"'"'\r' || true)
if [ -n "$CLE_RESA" ] && [ "$CLE_RESA" != "$(lire RESA_ADMIN_KEY)" ]; then
  echo "ATTENTION : RESA_ADMIN_KEY diffère entre /etc/coaching-resa.env et $ENV_FILE (écran Réservations en erreur)."
fi

# 1. Nouvelle version testée et construite sur une copie d'essai (avec les dépendances de test et de build)
sudo -u "$APP_USER" git -C "$DEPOT" fetch -q origin main
ANCIEN=$(sudo -u "$APP_USER" git -C "$DEPOT" rev-parse HEAD)
NOUVEAU=$(sudo -u "$APP_USER" git -C "$DEPOT" rev-parse origin/main)
if [ ! -d "$ESSAI/.git" ]; then
  sudo -u "$APP_USER" git clone -q --no-checkout "$DEPOT" "$ESSAI"
fi
sudo -u "$APP_USER" git -C "$ESSAI" fetch -q "$DEPOT" "$NOUVEAU"
sudo -u "$APP_USER" git -C "$ESSAI" checkout -q --force --detach "$NOUVEAU"
if ! ( cd "$ESSAI" \
       && sudo -u "$APP_USER" npm ci --no-audit --no-fund --loglevel=error \
       && sudo -u "$APP_USER" env -u NODE_ENV npx vitest run serveur/tests \
       && sudo -u "$APP_USER" env -u NODE_ENV VITE_BACKEND=api npm run build ); then
  echo "ÉCHEC des tests ou du build : version $NOUVEAU refusée, la version en ligne ($ANCIEN) est conservée."
  exit 1
fi
[ -f "$ESSAI/dist/index.html" ] || { echo "dist/index.html absent après le build : rien n'est changé."; exit 1; }

# 2. Code : avance rapide seulement, puis dépendances de production
sudo -u "$APP_USER" git -C "$DEPOT" merge --ff-only -q "$NOUVEAU"
( cd "$DEPOT" && sudo -u "$APP_USER" npm ci --omit=dev --no-audit --no-fund --loglevel=error )

# 3. Site : copié à côté puis échangé d'un coup
NEUF=$APP_DIR/site-nouveau
rm -rf "$NEUF"
mkdir -p "$NEUF"
cp -a "$ESSAI/dist/." "$NEUF/"
chown -R root:root "$NEUF"
chmod -R u=rwX,go=rX "$NEUF"
rm -rf "$APP_DIR/site-ancien"
[ -d "$APP_DIR/site" ] && mv "$APP_DIR/site" "$APP_DIR/site-ancien"
mv "$NEUF" "$APP_DIR/site"

# 4. Bloc Caddy : validé avec toute la config avant rechargement, sinon on garde l'ancien
CADDY_TMP=$(mktemp)
sed "s/A_REMPLACER_DOMAINE/$DOMAINE/g" "$DEPOT/deploiement/app-coaching.caddy" > "$CADDY_TMP"
mkdir -p "$(dirname "$CADDY_BLOC")"
rm -f "$CADDY_BLOC.ancien"
cp -a "$CADDY_BLOC" "$CADDY_BLOC.ancien" 2>/dev/null || true
install -m 0644 "$CADDY_TMP" "$CADDY_BLOC"
rm -f "$CADDY_TMP"
if caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  systemctl reload caddy
  grep -q 'import /etc/caddy/sites/\*.caddy' /etc/caddy/Caddyfile \
    || echo "ATTENTION : /etc/caddy/Caddyfile n'importe pas encore /etc/caddy/sites/*.caddy."
else
  echo "ATTENTION : config Caddy invalide, ancien bloc remis (caddy validate --config /etc/caddy/Caddyfile pour voir l'erreur)."
  if [ -f "$CADDY_BLOC.ancien" ]; then install -m 0644 "$CADDY_BLOC.ancien" "$CADDY_BLOC"; else rm -f "$CADDY_BLOC"; fi
fi
rm -f "$CADDY_BLOC.ancien"

# 5. Service + vérification (/api/app/moi : 200 ou 401 = le serveur répond), retour arrière sinon
D=$DEPOT/deploiement
install -m 0644 "$D/app-coaching.service" "$D/app-coaching-sauvegarde.service" "$D/app-coaching-sauvegarde.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable app-coaching >/dev/null
systemctl enable --now app-coaching-sauvegarde.timer >/dev/null
systemctl restart app-coaching
OK=0
for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  CODE=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5405/api/app/moi 2>/dev/null || true)
  if [ "$CODE" = 200 ] || [ "$CODE" = 401 ]; then OK=1; break; fi
done
if [ "$OK" != 1 ]; then
  echo "ÉCHEC : le serveur ne répond pas. Retour à $ANCIEN (journal : journalctl -u app-coaching -n 50)."
  sudo -u "$APP_USER" git -C "$DEPOT" reset -q --keep "$ANCIEN"
  ( cd "$DEPOT" && sudo -u "$APP_USER" npm ci --omit=dev --no-audit --no-fund --loglevel=error )
  if [ -d "$APP_DIR/site-ancien" ]; then
    rm -rf "$APP_DIR/site-echec"
    mv "$APP_DIR/site" "$APP_DIR/site-echec"
    mv "$APP_DIR/site-ancien" "$APP_DIR/site"
  fi
  systemctl restart app-coaching
  exit 1
fi
systemctl is-active app-coaching
echo "Déployé : $(sudo -u "$APP_USER" git -C "$DEPOT" log --oneline -1) · https://app.$DOMAINE"
}
main "$@"
exit
