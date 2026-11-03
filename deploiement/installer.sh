#!/usr/bin/env bash
# Installation de l'app-coaching sur le VPS commun (pc-seniors), lancé en root.
# Prérequis : installer-vps.sh de pc-seniors déjà passé (Node 24, Caddy, pare-feu).
# Peut être relancé sans risque : chaque étape vérifie ce qui existe déjà.
# Usage : bash installer.sh mon-domaine.fr        (l'app sera sur https://app.mon-domaine.fr)
#   1er passage : crée l'utilisateur et la clé GitHub, affiche la clé à ajouter sur GitHub, puis s'arrête.
#   2e passage (clé ajoutée) : clone, dépendances, service, fichier de secrets, timer de sauvegarde.
main() {
set -euo pipefail

APP_USER=appcoaching
APP_HOME=/var/lib/appcoaching
APP_DIR=/var/www/app-coaching
DEPOT=git@github.com:CorentinDelmee/app-coaching.git
ENV_FILE=/etc/app-coaching.env
DOMAINE=${1:-}

etape() { printf '\n\033[1;33m==> %s\033[0m\n' "$1"; }

[ "$(id -u)" -eq 0 ] || { echo "À lancer en root (ssh root@IP)."; exit 1; }
command -v node >/dev/null && command -v caddy >/dev/null && command -v openssl >/dev/null \
  || { echo "Node, Caddy ou openssl absent : lancer d'abord installer-vps.sh (pc-seniors)."; exit 1; }

etape "1/6 Dossier des sites Caddy (le bloc app-coaching.caddy est écrit par deployer.sh)"
install -d -m 0755 /etc/caddy/sites

etape "2/6 Utilisateur système '$APP_USER' (sans shell) et dossiers"
id "$APP_USER" >/dev/null 2>&1 \
  || useradd --system --home-dir "$APP_HOME" --create-home --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" -m 0755 "$APP_DIR"
install -d -m 0755 "$APP_DIR/site"

etape "3/6 Clé de déploiement GitHub (lecture seule) pour '$APP_USER'"
KEY=$APP_HOME/.ssh/id_ed25519
if [ ! -f "$KEY" ]; then
  sudo -u "$APP_USER" mkdir -p -m 0700 "$APP_HOME/.ssh"
  sudo -u "$APP_USER" ssh-keygen -t ed25519 -N "" -C "vps-app-coaching" -f "$KEY" -q
fi
sudo -u "$APP_USER" sh -c "ssh-keyscan -t ed25519 github.com >> $APP_HOME/.ssh/known_hosts 2>/dev/null; sort -u -o $APP_HOME/.ssh/known_hosts $APP_HOME/.ssh/known_hosts"
if ! sudo -u "$APP_USER" git ls-remote -q "$DEPOT" >/dev/null 2>&1; then
  echo
  echo "GitHub refuse encore l'accès. À copier dans GitHub → dépôt app-coaching → Settings → Deploy keys"
  echo "→ Add deploy key (titre : VPS, NE PAS cocher « Allow write access ») :"
  echo
  cat "$KEY.pub"
  echo
  echo "Puis relancer : bash installer.sh ${DOMAINE:-mon-domaine.fr}"
  return 0
fi

etape "4/6 Clone du dépôt et dépendances de production"
if [ ! -d "$APP_DIR/depot/.git" ]; then
  sudo -u "$APP_USER" git clone -q --depth 1 "$DEPOT" "$APP_DIR/depot"
fi
cd "$APP_DIR/depot"
sudo -u "$APP_USER" npm ci --omit=dev --no-audit --no-fund --loglevel=error

etape "5/6 Fichier de secrets $ENV_FILE (root, chmod 600)"
if [ ! -f "$ENV_FILE" ]; then
  [ -n "$DOMAINE" ] || { echo "Donner le domaine : bash installer.sh mon-domaine.fr"; exit 1; }
  # RESA_ADMIN_KEY : reprise de l'API réservation si elle est déjà installée (doit être identique des deux côtés)
  RESA_KEY=$(sed -n 's/^RESA_ADMIN_KEY=//p' /etc/coaching-resa.env 2>/dev/null | tail -n 1 | tr -d '"'"'"'\r' || true)
  ( umask 077
    cat > "$ENV_FILE" <<EOT
# Secrets de l'app-coaching (lu par systemd). Ne jamais copier ce fichier ailleurs.
NODE_ENV=production
PORT=5405
HOST=127.0.0.1
DB_FILE=/var/lib/app-coaching/app.db
FICHIERS_DIR=/var/lib/app-coaching/fichiers
APP_ORIGIN=https://app.$DOMAINE
SESSION_SECRET=$(openssl rand -base64 48 | tr -d '\n')
COACH_API_KEY=$(openssl rand -base64 48 | tr -d '\n')
# Clé ajoutée par Caddy (X-Proxy-Cle) : seule preuve que X-Forwarded-For est fiable. Hexadécimal (sûr dans sed).
PROXY_KEY=$(openssl rand -hex 32)
# Clé PUBLIQUE age des sauvegardes (age1…), générée sur le Mac de Corentin : voir LISEZMOI. Vide = sauvegardes non chiffrées.
BACKUP_AGE_RECIPIENT=
RESA_API_URL=http://127.0.0.1:5311
# Doit être IDENTIQUE à RESA_ADMIN_KEY de /etc/coaching-resa.env
RESA_ADMIN_KEY=$RESA_KEY
EOT
  )
fi
chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"

etape "6/6 Service systemd + sauvegarde quotidienne (rien n'est démarré : deployer.sh s'en charge)"
D=$APP_DIR/depot/deploiement
install -m 0644 "$D/app-coaching.service" "$D/app-coaching-sauvegarde.service" "$D/app-coaching-sauvegarde.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable app-coaching >/dev/null
systemctl enable --now app-coaching-sauvegarde.timer >/dev/null

echo
echo "================ TERMINÉ ================"
echo "1. Créer le compte coach (voir deploiement/LISEZMOI.md, étape 4), après le 1er déploiement."
if grep -q '^RESA_ADMIN_KEY=$' "$ENV_FILE"; then
  echo "2. RESA_ADMIN_KEY est vide : la copier depuis /etc/coaching-resa.env (nano $ENV_FILE)."
fi
echo "3. Mettre en ligne : bash $APP_DIR/depot/deploiement/deployer.sh"
}
main "$@"
exit
