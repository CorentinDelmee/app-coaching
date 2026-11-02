# Mettre en ligne l'app-coaching sur le VPS (guide de Corentin)

✋ = c'est toi qui le fais · 🤖 = c'est le script qui le fait · Durée ≈ 25 min (hors attente DNS).
Contrat technique : `docs/CONTRAT-VPS.md`. L'app sera sur `https://app.mon-domaine.fr` (même VPS que le site vitrine et pc-seniors).

| Fichier | Rôle |
|---|---|
| `installer.sh` | Une fois : utilisateur `appcoaching`, clé GitHub (lecture seule), clone, `/etc/app-coaching.env` (secrets générés), service, timer. |
| `deployer.sh` | Chaque mise en ligne : tests serveur + build `VITE_BACKEND=api` sur une copie, mise à jour, échange atomique de la PWA, Caddy, redémarrage, vérification, retour arrière si échec. |
| `app-coaching.service` | Serveur Node 127.0.0.1:5405, durci, 384 Mo max, seul `/var/lib/app-coaching` inscriptible. |
| `app-coaching.caddy` | Bloc Caddy (HTTPS, CSP, `/api/app/*` → Node, repli SPA, cache). |
| `sauvegarder.sh` + `app-coaching-sauvegarde.{service,timer}` | Chaque nuit à 4 h : `app.db` + `fichiers/`, 14 jours conservés. |

## 1. DNS (≈ 5 min + propagation)
✋ Hostinger → Domaines → ton domaine → DNS : ajoute `A` · `app` → l'IP du VPS (la même que `@`), et `AAAA` · `app` seulement si `@` en a une.
Vérifie : `dig +short app.mon-domaine.fr` = IP du VPS. (Caddy obtient le certificat HTTPS tout seul une fois le DNS propagé.)

## 2. Installer (≈ 10 min)
Si le site vitrine est déjà installé, l'utilisateur et Caddy existent : rien d'autre à préparer. Sinon, voir `coaching-domicile/reservation/deploiement/LISEZMOI.md` (accord des associés inclus).
1. ✋ Envoie et lance (remplace `IP` ; le domaine est le domaine **de base**, sans `app.`) :
   ```
   scp ~/Documents/REXV2/Projets/app-coaching/deploiement/installer.sh root@IP:/root/installer-app.sh
   ssh root@IP "bash /root/installer-app.sh mon-domaine.fr"
   ```
   🤖 Crée `appcoaching` et **affiche une clé** `ssh-ed25519 …`.
2. ✋ GitHub → dépôt **app-coaching** → Settings → **Deploy keys** → Add deploy key → titre `VPS`, colle la clé, **ne coche pas** « Allow write access ». Relance la même commande `ssh … installer-app.sh mon-domaine.fr`.
   🤖 Clone, dépendances, génère `/etc/app-coaching.env` (root, chmod 600) avec `SESSION_SECRET` et `COACH_API_KEY` aléatoires, reprend `RESA_ADMIN_KEY` de `/etc/coaching-resa.env` si elle existe, active le service et la sauvegarde.

## 3. Variables d'environnement (`/etc/app-coaching.env`)
| Variable | Valeur |
|---|---|
| `NODE_ENV` `PORT` `HOST` | `production` · `5405` · `127.0.0.1` (déjà écrits) |
| `DB_FILE` · `FICHIERS_DIR` | `/var/lib/app-coaching/app.db` · `/var/lib/app-coaching/fichiers` |
| `APP_ORIGIN` | `https://app.mon-domaine.fr` (contrôle CSRF : doit être exact) |
| `SESSION_SECRET` · `COACH_API_KEY` | générés par l'installeur (≥ 32 car.) ; `COACH_API_KEY` sert au MCP/REST |
| `RESA_API_URL` | `http://127.0.0.1:5311` |
| `RESA_ADMIN_KEY` | **identique** à celle de `/etc/coaching-resa.env`. Si elle est vide : `grep RESA_ADMIN_KEY /etc/coaching-resa.env`, puis `nano /etc/app-coaching.env` (`Ctrl+O`, `Entrée`, `Ctrl+X`). Jamais dans une conversation. |
`deployer.sh` refuse de continuer si une variable est vide, et signale si les deux `RESA_ADMIN_KEY` diffèrent.

## 4. Mettre en ligne puis créer ton compte coach
1. ✋ `ssh root@IP "bash /var/www/app-coaching/depot/deploiement/deployer.sh"` → doit finir par `active` et `Déployé : …`.
2. ✋ Crée le compte (saisie masquée du code) :
   ```
   ssh -t root@IP "cd /var/www/app-coaching/depot && sudo -u appcoaching env DB_FILE=/var/lib/app-coaching/app.db FICHIERS_DIR=/var/lib/app-coaching/fichiers npm run coach:creer corentin"
   ```
   (`env` est nécessaire car le fichier de secrets est illisible par `appcoaching` ; seules ces deux variables sont utiles à la commande.)
3. ✋ Ouvre `https://app.mon-domaine.fr`, connecte-toi (`corentin` + ton code), va dans l'espace coach → **Réservations**.
4. ✋ Installe l'app sur ton téléphone (« Ajouter à l'écran d'accueil »).

## 5. Vérifications
- `ssh root@IP "curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5405/api/app/moi"` → `401` (serveur vivant, non connecté).
- Les vidéos d'exercices (YouTube) s'affichent dans une séance ; une photo envoyée s'affiche (CSP : `img-src blob:`).
- Sauvegarde : `ssh root@IP "systemctl start app-coaching-sauvegarde && cat /var/lib/app-coaching/derniere-sauvegarde.txt"` → `OK …`.
- 🤖 Dis « c'est en ligne » à REX : il vérifie pages, HTTPS et mobile avec un navigateur automatique.

## 6. Mises à jour et restauration
Après un push : relancer la commande 4.1. Pas de mise à jour automatique (production réelle).
Restaurer : `systemctl stop app-coaching; gunzip -c /var/lib/app-coaching/sauvegardes/app-AAAA-MM-JJ.db.gz > /var/lib/app-coaching/app.db; tar -xzf /var/lib/app-coaching/sauvegardes/fichiers-AAAA-MM-JJ.tar.gz -C /var/lib/app-coaching; chown -R appcoaching:appcoaching /var/lib/app-coaching; systemctl start app-coaching`.

## 7. Dépannage
| Problème | Que faire |
|---|---|
| Le service ne démarre pas | `journalctl -u app-coaching -n 50` (variable manquante : le serveur refuse de démarrer en production). |
| Connexion refusée (403) | `APP_ORIGIN` ne correspond pas exactement à l'adresse ouverte. |
| Écran Réservations en erreur 502 | L'API `coaching-resa` est arrêtée ou les `RESA_ADMIN_KEY` diffèrent. |
| `deployer.sh` : « ÉCHEC des tests ou du build » | La version en ligne n'a pas bougé ; donner le message à REX. |
| Pas de HTTPS | `journalctl -u caddy -n 50` (DNS de `app.` pas encore propagé). |
| Ancienne version affichée sur le téléphone | La PWA propose « mettre à jour » ; fermer et rouvrir l'app. |

## 8. À savoir (sécurité)
Toute personne root sur le VPS (tes associés) peut lire `/etc/app-coaching.env`, la base et les fichiers de tes clients (séances, mesures, photos). À assumer avec eux avant d'y mettre de vraies données clients. Sauvegarde : uniquement sur le VPS (pas de copie hors serveur pour l'instant).
