# Mettre en ligne l'app-coaching sur le VPS (guide de Corentin)

✋ = c'est toi qui le fais · 🤖 = c'est le script qui le fait · Durée ≈ 25 min (hors attente DNS).
Contrat technique : `docs/CONTRAT-VPS.md`. L'app sera sur `https://app.delmeecorentin.fr` (même VPS que le site vitrine et pc-seniors).

| Fichier | Rôle |
|---|---|
| `installer.sh` | Une fois : utilisateur `appcoaching`, clé GitHub (lecture seule), clone, `/etc/app-coaching.env` (secrets générés), service, timer. |
| `deployer.sh` | Chaque mise en ligne : tests serveur + build `VITE_BACKEND=api` sur une copie, mise à jour, échange atomique de la PWA, Caddy, redémarrage, vérification, retour arrière si échec. |
| `app-coaching.service` | Serveur Node 127.0.0.1:5405, durci, 384 Mo max, seul `/var/lib/app-coaching` inscriptible. |
| `app-coaching.caddy` | Bloc Caddy (HTTPS, CSP, `/api/app/*` → Node, repli SPA, cache). |
| `sauvegarder.sh` + `app-coaching-sauvegarde.{service,timer}` | Chaque nuit à 4 h : `app.db` + `fichiers/`, 14 jours conservés. |

**Ce que root exécute, et d'où ça vient.** `installer.sh` et `deployer.sh` copient les scripts lancés en root, les unités systemd
et le bloc Caddy du dépôt vers `/opt/app-coaching/` (propriétaire root, 0755 / 0644) avant de les installer ou de les lancer :
root n'exécute jamais un fichier du clone, que l'utilisateur `appcoaching` pourrait modifier (la sauvegarde nocturne lance aussi
`/opt/app-coaching/sauvegarder.sh`). Les mises en ligne se font par `bash /opt/app-coaching/deployer.sh`. La confiance repose
sur **la branche `main` de GitHub** (ce qui y est poussé finit exécuté en root au déploiement suivant, après les tests) et sur la
**clé de déploiement en lecture seule** du VPS (jamais « Allow write access ») : protège ton compte GitHub (double authentification).

**Installation déjà passée avec l'ancienne version** (clone et `/etc/app-coaching.env` présents, unités pointant vers le clone) :
```
ssh root@IP "sudo -u appcoaching git -C /var/www/app-coaching/depot pull --ff-only && bash /var/www/app-coaching/depot/deploiement/installer.sh delmeecorentin.fr"
```
(dernière fois qu'on lance un fichier du clone : à ce stade il est encore de confiance). Cela crée `/opt/app-coaching`, réinstalle les unités
et ne touche pas à `/etc/app-coaching.env` ; relançable sans risque. Ensuite, toujours `bash /opt/app-coaching/deployer.sh`.

## 1. DNS (≈ 5 min + propagation)
✋ Hostinger → Domaines → delmeecorentin.fr → DNS : ajoute `A` · `app` → l'IP du VPS (la même que `@`), et `AAAA` · `app` seulement si `@` en a une.
Vérifie : `dig +short app.delmeecorentin.fr` = IP du VPS. (Caddy obtient le certificat HTTPS tout seul une fois le DNS propagé.)

## 2. Installer (≈ 10 min)
Si le site vitrine est déjà installé, l'utilisateur et Caddy existent : rien d'autre à préparer. Sinon, voir `coaching-domicile/reservation/deploiement/LISEZMOI.md` (accord des associés inclus).
1. ✋ Envoie et lance (remplace `IP` ; le domaine est le domaine **de base**, sans `app.`) :
   ```
   scp ~/Documents/REXV2/Projets/app-coaching/deploiement/installer.sh root@IP:/root/installer-app.sh
   ssh root@IP "bash /root/installer-app.sh delmeecorentin.fr"
   ```
   🤖 Crée `appcoaching` et **affiche une clé** `ssh-ed25519 …`.
2. ✋ GitHub → dépôt **app-coaching** → Settings → **Deploy keys** → Add deploy key → titre `VPS`, colle la clé, **ne coche pas** « Allow write access ». Relance la même commande `ssh … installer-app.sh delmeecorentin.fr`.
   🤖 Clone, dépendances, génère `/etc/app-coaching.env` (root, chmod 600) avec `SESSION_SECRET` et `COACH_API_KEY` aléatoires, reprend `RESA_ADMIN_KEY` de `/etc/coaching-resa.env` si elle existe, active le service et la sauvegarde.

## 3. Variables d'environnement (`/etc/app-coaching.env`)
| Variable | Valeur |
|---|---|
| `NODE_ENV` `PORT` `HOST` | `production` · `5405` · `127.0.0.1` (déjà écrits) |
| `DB_FILE` · `FICHIERS_DIR` · `DATA_DIR` | `/var/lib/app-coaching/app.db` · `/var/lib/app-coaching/fichiers` · `/var/lib/app-coaching/data` (bibliothèque d'exercices : le dossier du code est en lecture seule) |
| `APP_ORIGIN` | `https://app.delmeecorentin.fr` (contrôle CSRF : doit être exact) |
| `SESSION_SECRET` · `COACH_API_KEY` | générés par l'installeur (≥ 32 car.) ; `COACH_API_KEY` sert au MCP/REST |
| `RESA_API_URL` | `http://127.0.0.1:5311` (même VPS : l'API publique du site est `https://delmeecorentin.fr/api/resa`, l'app l'appelle en local) |
| `RESA_ADMIN_KEY` | **identique** à celle de `/etc/coaching-resa.env`. Si elle est vide : `grep RESA_ADMIN_KEY /etc/coaching-resa.env`, puis `nano /etc/app-coaching.env` (`Ctrl+O`, `Entrée`, `Ctrl+X`). Jamais dans une conversation. |
`deployer.sh` refuse de continuer si une variable est vide, et signale si les deux `RESA_ADMIN_KEY` diffèrent.

## 4. Mettre en ligne puis créer ton compte coach
1. ✋ `ssh root@IP "bash /opt/app-coaching/deployer.sh"` → doit finir par `active` et `Déployé : …`.
2. ✋ Crée le compte (saisie masquée du code) :
   ```
   ssh -t root@IP "cd /var/www/app-coaching/depot && sudo -u appcoaching env DB_FILE=/var/lib/app-coaching/app.db FICHIERS_DIR=/var/lib/app-coaching/fichiers npm run coach:creer corentin"
   ```
   (`env` est nécessaire car le fichier de secrets est illisible par `appcoaching` ; seules ces deux variables sont utiles à la commande.)
3. ✋ Ouvre `https://app.delmeecorentin.fr`, connecte-toi (`corentin` + ton code), va dans l'espace coach → **Réservations**.
4. ✋ Installe l'app sur ton téléphone (« Ajouter à l'écran d'accueil »).

## 5. Vérifications
- `ssh root@IP "curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5405/api/app/moi"` → `401` (serveur vivant, non connecté).
- Les vidéos d'exercices (YouTube) s'affichent dans une séance ; une photo envoyée s'affiche (CSP : `img-src blob:`).
- Sauvegarde : `ssh root@IP "systemctl start app-coaching-sauvegarde && cat /var/lib/app-coaching/derniere-sauvegarde.txt"` → `OK … · chiffrée …`.
- IP réelle (X-Forwarded-For forgé ignoré) : depuis le VPS, 6 essais ratés avec une fausse IP différente à chaque fois, le 6e doit répondre `429` :
  ```
  ssh root@IP 'for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:5405/api/app/connexion -H "Origin: $(sed -n "s/^APP_ORIGIN=//p" /etc/app-coaching.env)" -H "Content-Type: application/json" -H "X-Forwarded-For: 203.0.113.$i" -d "{\"identifiant\":\"essai-proxy\",\"code\":\"faux\"}"; done'
  ```
  → `401` ×5 puis `429` (sans la clé `X-Proxy-Cle`, toutes ces requêtes comptent pour la même IP). Attendre 15 min avant de réessayer avec ce même identifiant.
- 🤖 Dis « c'est en ligne » à REX : il vérifie pages, HTTPS et mobile avec un navigateur automatique.

## 6. Mises à jour et restauration
Après un push : relancer la commande 4.1 (`bash /opt/app-coaching/deployer.sh`, qui recopie scripts et unités dans `/opt` après le test). Pas de mise à jour automatique (production réelle).
### Sauvegardes chiffrées (à faire une fois)
1. ✋ Sur ton Mac : `brew install age` puis `age-keygen -o ~/cle-sauvegarde-coaching.txt`. La commande affiche la clé **publique** (`age1…`).
   La clé **privée** (le fichier) ne quitte jamais ton Mac : ni le VPS, ni Git, ni un cloud partagé. Garde-en une copie hors ligne (clé USB) : sans elle, les sauvegardes sont illisibles.
2. ✋ Sur le VPS : `ssh root@IP "apt install -y age"` puis `nano /etc/app-coaching.env` → `BACKUP_AGE_RECIPIENT=age1…` (la clé publique).
3. ✋ Vérifier : la commande « Sauvegarde » du § 5 doit afficher `chiffrée`. Sans clé, le journal affiche `ATTENTION : sauvegardes NON chiffrées`.
4. ✋ Copie hors VPS (toi, pas d'envoi automatique vers un service tiers), par exemple chaque semaine depuis le Mac :
   `scp root@IP:/var/lib/app-coaching/sauvegardes/*.age ~/Sauvegardes-coaching/`

Restaurer une sauvegarde chiffrée : sur le Mac, `age -d -i ~/cle-sauvegarde-coaching.txt app-AAAA-MM-JJ.db.gz.age | gunzip > app.db`
(et `age -d -i ~/cle-sauvegarde-coaching.txt fichiers-AAAA-MM-JJ.tar.gz.age > fichiers.tar.gz`), puis `scp` vers le VPS et suivre la ligne ci-dessous.
Restaurer (fichiers en clair) : `systemctl stop app-coaching; gunzip -c /var/lib/app-coaching/sauvegardes/app-AAAA-MM-JJ.db.gz > /var/lib/app-coaching/app.db; tar -xzf /var/lib/app-coaching/sauvegardes/fichiers-AAAA-MM-JJ.tar.gz -C /var/lib/app-coaching; chown -R appcoaching:appcoaching /var/lib/app-coaching; systemctl start app-coaching`.

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
Toute personne root sur le VPS (tes associés) peut lire `/etc/app-coaching.env`, la base et les fichiers de tes clients (séances, mesures, photos). À assumer avec eux avant d'y mettre de vraies données clients. Sauvegardes : chiffrées avec ta clé publique dès que `BACKUP_AGE_RECIPIENT` est rempli (un root du VPS ne peut alors pas les lire, mais il peut toujours lire la base en direct) ; la copie hors serveur est à faire par toi (§ 6).
