#!/usr/bin/env bash
# Met en ligne la dernière version de l'app-coaching (lancé en root sur le VPS) : serveur + PWA + bloc Caddy.
# Étapes : essai sur une copie (npm ci + tests serveur + build VITE_BACKEND=api) → git merge --ff-only
# → npm ci --omit=dev → dist/ copié dans un dossier neuf puis échangé d'un coup → redémarrage → vérification.
# Si la vérification échoue : retour à la version précédente (code + site).
# Usage : bash /opt/app-coaching/deployer.sh (copie root:root ; jamais le fichier du clone).
# Tout est dans main() : un git pull qui modifie ce fichier pendant qu'il tourne ne le casse pas.
main() {
set -euo pipefail
APP_USER=appcoaching
APP_DIR=/var/www/app-coaching
DEPOT=$APP_DIR/depot
ESSAI=$APP_DIR/essai
ENV_FILE=/etc/app-coaching.env
CADDY_BLOC=/etc/caddy/sites/app-coaching.caddy
# Mode sous-chemin (APP_BASE=/app/) : fragment importé par le bloc du site + redirection de l'ancienne adresse app.<domaine>
CADDY_REDIR=/etc/caddy/sites/app-coaching-redirection.caddy
# Copie root:root des fichiers exécutés ou installés par root (scripts 0755, unités et bloc Caddy 0644) :
# root n'exécute jamais un fichier du dépôt, que l'utilisateur 'appcoaching' pourrait modifier.
OPT=/opt/app-coaching
copier_opt() {
  local D=$DEPOT/deploiement
  install -d -o root -g root -m 0755 "$OPT"
  install -o root -g root -m 0755 "$D/deployer.sh" "$D/installer.sh" "$D/sauvegarder.sh" "$OPT/"
  install -o root -g root -m 0644 "$D/app-coaching.service" "$D/app-coaching-sauvegarde.service"     "$D/app-coaching-sauvegarde.timer" "$D/app-coaching.caddy" \
    "$D/app-coaching-chemin.caddy" "$D/app-coaching-redirection.caddy" "$OPT/"
}

[ "$(id -u)" -eq 0 ] || { echo "À lancer en root."; exit 1; }
[ -d "$DEPOT/.git" ] || { echo "Dépôt absent : lancer d'abord installer.sh."; exit 1; }
[ -f "$ENV_FILE" ] || { echo "Il manque $ENV_FILE : lancer installer.sh."; exit 1; }

# Lecture d'une valeur du fichier de secrets sans l'exécuter (jamais de « source » sur des secrets)
lire() { sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | tr -d '"'"'"'\r'; }
# PROXY_KEY : ajoutée aux installations existantes (anciennes versions d'installer.sh)
if [ -z "$(lire PROXY_KEY)" ]; then
  ( umask 077; printf '\nPROXY_KEY=%s\n' "$(openssl rand -hex 32)" >> "$ENV_FILE" )
  echo "PROXY_KEY ajoutée à $ENV_FILE."
fi
case "$(lire PROXY_KEY)" in *[!0-9a-f]*) echo "PROXY_KEY doit être en hexadécimal (openssl rand -hex 32)."; exit 1;; esac
[ "$(lire PROXY_KEY | wc -c)" -gt 32 ] || { echo "PROXY_KEY trop courte (32 caractères minimum)."; exit 1; }
for V in PROXY_KEY SESSION_SECRET COACH_API_KEY RESA_API_URL RESA_ADMIN_KEY APP_ORIGIN DB_FILE FICHIERS_DIR; do
  [ -n "$(lire "$V")" ] || { echo "$V est vide dans $ENV_FILE : le remplir (nano $ENV_FILE)."; exit 1; }
done
# Adresse de l'app : APP_BASE='/' (défaut) = domaine propre https://app.<domaine> ; '/app/' = sous-chemin du site https://<domaine>/app/.
# APP_SCOPE = portée du manifeste (défaut APP_BASE ; '/' pour installer l'app depuis la page du site).
APP_BASE=$(lire APP_BASE); APP_BASE=${APP_BASE:-/}
APP_SCOPE=$(lire APP_SCOPE); APP_SCOPE=${APP_SCOPE:-$APP_BASE}
for V in "$APP_BASE" "$APP_SCOPE"; do
  echo "$V" | grep -Eq '^/([a-z0-9-]+/)*$' || { echo "APP_BASE / APP_SCOPE invalide ($V) : ex. / ou /app/ (barre au début et à la fin)."; exit 1; }
done
case "$APP_BASE" in "$APP_SCOPE"*) ;; *) echo "APP_BASE ($APP_BASE) doit être dans APP_SCOPE ($APP_SCOPE)."; exit 1;; esac
PREFIXE=
if [ "$APP_BASE" = / ]; then
  case "$(lire APP_ORIGIN)" in https://app.*) ;; *) echo "APP_ORIGIN doit être https://app.<domaine> (APP_BASE=/)."; exit 1;; esac
  DOMAINE=$(lire APP_ORIGIN | sed -e 's#^https://app\.##' -e 's#/*$##')
else
  DOMAINE=$(lire APP_ORIGIN | sed -e 's#^https://##')
  PREFIXE=${APP_BASE%/}
  CADDY_FRAG=/etc/caddy/sites/$DOMAINE.d/app-coaching.caddy
fi
echo "$DOMAINE" | grep -Eq '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]+$' \
  || { echo "APP_ORIGIN doit être l'origine exacte, sans chemin ni barre finale (ex. https://delmeecorentin.fr)."; exit 1; }
# Sous-chemin : le bloc du site doit déjà importer son dossier de fragments (déployer le site AVANT l'app)
if [ "$APP_BASE" != / ] && ! grep -qsF "import /etc/caddy/sites/$DOMAINE.d/" /etc/caddy/Caddyfile /etc/caddy/sites/*.caddy; then
  echo "Le bloc Caddy du site n'importe pas /etc/caddy/sites/$DOMAINE.d/*.caddy : déployer d'abord le site, puis relancer."; exit 1
fi
# Les deux clés RESA_ADMIN_KEY doivent être identiques (sinon l'écran Réservations répond 502)
CLE_RESA=$(sed -n 's/^RESA_ADMIN_KEY=//p' /etc/coaching-resa.env 2>/dev/null | tail -n 1 | tr -d '"'"'"'\r' || true)
if [ -n "$CLE_RESA" ] && [ "$CLE_RESA" != "$(lire RESA_ADMIN_KEY)" ]; then
  echo "ATTENTION : RESA_ADMIN_KEY diffère entre /etc/coaching-resa.env et $ENV_FILE (écran Réservations en erreur)."
fi

# 0. Sauvegarde AVANT toute modification : le redémarrage de l'étape 5 applique les migrations de la base (audit M5/R2).
# Échec = arrêt net, rien n'a été touché. Le fichier porte l'heure : il ne remplace pas la sauvegarde de la nuit (voir sauvegarder.sh).
if systemctl cat app-coaching-sauvegarde.service >/dev/null 2>&1; then
  if ! systemctl start app-coaching-sauvegarde.service; then
    echo "ÉCHEC : sauvegarde avant déploiement impossible (journalctl -u app-coaching-sauvegarde -n 30). Rien n'a été modifié ; relance deployer.sh une fois réglé."
    exit 1
  fi
else
  echo "Unité de sauvegarde absente (première installation ?) : pas de sauvegarde avant déploiement."
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
       && sudo -u "$APP_USER" env -u NODE_ENV VITE_BACKEND=api APP_BASE="$APP_BASE" APP_SCOPE="$APP_SCOPE" npm run build ); then
  echo "ÉCHEC des tests ou du build : version $NOUVEAU refusée, la version en ligne ($ANCIEN) est conservée."
  exit 1
fi
[ -f "$ESSAI/dist/index.html" ] || { echo "dist/index.html absent après le build : rien n'est changé."; exit 1; }

# 2. Code : avance rapide seulement, puis dépendances de production
sudo -u "$APP_USER" git -C "$DEPOT" merge --ff-only -q "$NOUVEAU"
( cd "$DEPOT" && sudo -u "$APP_USER" npm ci --omit=dev --no-audit --no-fund --loglevel=error )
copier_opt

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

# 4. Caddy : fichiers écrits, toute la config validée avant rechargement, sinon retour aux anciens fichiers.
#    Domaine propre : bloc complet (CADDY_BLOC), fragment et redirection retirés.
#    Sous-chemin : fragment (CADDY_FRAG) + redirection (CADDY_REDIR), ancien bloc supprimé.
#    0640 root:caddy : les fichiers peuvent contenir PROXY_KEY (lisibles par Caddy seulement).
gabarit() { sed -e "s/A_REMPLACER_DOMAINE/$DOMAINE/g" -e "s#A_REMPLACER_PREFIXE#$PREFIXE#g" -e "s/A_REMPLACER_PROXY_KEY/$(lire PROXY_KEY)/g" "$OPT/$1"; }
ecrire() { local T; T=$(mktemp); gabarit "$1" > "$T"; mkdir -p "$(dirname "$2")"; install -m 0640 -o root -g caddy "$T" "$2"; rm -f "$T"; }
if [ "$APP_BASE" = / ]; then FICHIERS="$CADDY_BLOC $CADDY_REDIR $(ls /etc/caddy/sites/*.d/app-coaching.caddy 2>/dev/null || true)"
else FICHIERS="$CADDY_BLOC $CADDY_REDIR $CADDY_FRAG"; fi
for F in $FICHIERS; do rm -f "$F.ancien"; cp -a "$F" "$F.ancien" 2>/dev/null || true; done
if [ "$APP_BASE" = / ]; then
  ecrire app-coaching.caddy "$CADDY_BLOC"
  for F in $FICHIERS; do [ "$F" = "$CADDY_BLOC" ] || rm -f "$F"; done
else
  ecrire app-coaching-chemin.caddy "$CADDY_FRAG"
  ecrire app-coaching-redirection.caddy "$CADDY_REDIR"
  rm -f "$CADDY_BLOC"
fi
# Marqueur oublié (gabarit modifié sans deployer.sh) = config refusée comme une config invalide
RESTE=$(grep -l 'A_REMPLACER' $FICHIERS 2>/dev/null || true)
if [ -z "$RESTE" ] && caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  systemctl reload caddy
  grep -q 'import /etc/caddy/sites/\*.caddy' /etc/caddy/Caddyfile \
    || echo "ATTENTION : /etc/caddy/Caddyfile n'importe pas encore /etc/caddy/sites/*.caddy."
else
  [ -n "$RESTE" ] && echo "ATTENTION : marqueur A_REMPLACER restant dans $RESTE."
  echo "ATTENTION : config Caddy invalide, anciens fichiers remis (caddy validate --config /etc/caddy/Caddyfile pour voir l'erreur)."
  for F in $FICHIERS; do
    if [ -f "$F.ancien" ]; then install -m 0640 -o root -g caddy "$F.ancien" "$F"; else rm -f "$F"; fi
  done
fi
for F in $FICHIERS; do rm -f "$F.ancien"; done

# 5. Service + vérification (/api/app/moi : 200 ou 401 = le serveur répond), retour arrière sinon
D=$OPT
install -m 0644 "$D/app-coaching.service" "$D/app-coaching-sauvegarde.service" "$D/app-coaching-sauvegarde.timer" /etc/systemd/system/
systemctl daemon-reload
# La sauvegarde tourne désormais en appcoaching : reprendre les fichiers créés par l'ancienne version (root)
chown -R "$APP_USER:$APP_USER" /var/lib/app-coaching/sauvegardes /var/lib/app-coaching/derniere-sauvegarde.txt 2>/dev/null || true
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
  copier_opt
  install -m 0644 "$OPT/app-coaching.service" "$OPT/app-coaching-sauvegarde.service" "$OPT/app-coaching-sauvegarde.timer" /etc/systemd/system/
  systemctl daemon-reload
  if [ -d "$APP_DIR/site-ancien" ]; then
    rm -rf "$APP_DIR/site-echec"
    mv "$APP_DIR/site" "$APP_DIR/site-echec"
    mv "$APP_DIR/site-ancien" "$APP_DIR/site"
  fi
  systemctl restart app-coaching
  exit 1
fi
systemctl is-active app-coaching
echo "Déployé : $(sudo -u "$APP_USER" git -C "$DEPOT" log --oneline -1) · $(lire APP_ORIGIN)$APP_BASE"
}
main "$@"
exit
