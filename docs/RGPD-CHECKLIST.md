# Checklist RGPD — Corentin Delmée Coaching (app)

> Rédigé le 2026-10-20 par `juriste-admin`. **Document de repérage, pas un avis juridique. Rien ici ne dit que l'app est « conforme ».** Un humain (Corentin, idéalement relu par un juriste ou le DPO d'un organisme comme sa CCI / sa fédération) valide.
>
> **Sources** : textes du RGPD reproduits par la CNIL (https://www.cnil.fr/fr/reglement-europeen-protection-donnees), fiches CNIL (https://www.cnil.fr), Légifrance (https://www.legifrance.gouv.fr), esante.gouv.fr pour l'HDS. Les liens ci-dessous sont des pages d'accueil ou de rubriques connues ; **je n'ai pas rouvert chaque page cette session (consigne : pas de question, pas de navigation) : re-vérifier le texte à jour avant de s'y fier.**
>
> Légende : [FAIT] fait sourcé · [EST.] estimation · [HYP.] hypothèse à confirmer.

## 0. Situation de départ (faits du cahier des charges)
- Responsable de traitement : Corentin Delmée, micro-entrepreneur (il décide des finalités et des moyens). [FAIT]
- 10-15 clients, tous adultes à priori [HYP.]. Données : identité, identifiant/code, séances, poids, mensurations, douleurs (zone + intensité), nutrition (habitudes, calories, photos de repas), commentaires libres, réponses aux questionnaires.
- Douleurs, poids, nutrition liés à un individu = **données concernant la santé** → catégorie particulière, art. 9 RGPD. [FAIT pour douleurs ; poids/nutrition : à traiter par prudence comme santé] 
- Sous-traitants : Supabase (base + stockage, région UE), Netlify (hébergement du code statique). Tiers : WhatsApp (liens `wa.me`, messages envoyés par le client lui-même).

## 1. Base légale et consentement (art. 6, 7, 9)
| Point | Niveau | Détail |
|---|---|---|
| Données ordinaires (identité, séances, tarifs) | Obligatoire | Base : exécution du contrat de coaching (art. 6.1.b). À écrire dans la page Confidentialité. |
| Données de santé | Obligatoire | Exception à l'interdiction : **consentement explicite** (art. 9.2.a). Texte clair, case **non pré-cochée**, finalité précisée. Voir `texte-consentement.md`. |
| Consentement libre | À faire vérifier | Si refuser = ne pas être coaché, le consentement peut être jugé non libre. Prévoir une alternative : client qui refuse → accès au programme/séances sans modules douleurs/poids/nutrition (suivi hors app). |
| Preuve du consentement | Obligatoire | Stocker : date/heure, version du texte, identifiant du client (art. 7.1). |
| Retrait aussi simple que l'octroi | Obligatoire | Bouton dans Profil → « Retirer mon consentement » (stoppe la collecte santé ; propose de supprimer les données santé). |
| Re-consentement | Recommandé | Si le texte ou les finalités changent : nouvel écran avec nouvelle version. |

## 2. Information des personnes (art. 12-14)
- Obligatoire : identité du responsable, finalités, bases légales, destinataires (Supabase, Netlify), transferts éventuels, durées, droits, droit de réclamation CNIL, caractère facultatif/obligatoire des données. → `page-confidentialite.md` (brouillon).
- Obligatoire : accessible **avant** la collecte (lien sur l'écran de consentement) et depuis Profil + page d'accueil publique.
- Recommandé : même information remise en main propre / WhatsApp lors de la création du compte.

## 3. Registre des traitements (art. 30)
- Obligatoire ici : l'exemption des organismes de moins de 250 personnes **ne joue pas** si le traitement porte sur des données sensibles ou n'est pas occasionnel (art. 30.5). [FAIT, à faire confirmer]
- Modèle CNIL : https://www.cnil.fr/fr/RGDP-le-registre-des-activites-de-traitement
- Contenu minimal (1 fiche suffit pour « Suivi des clients dans l'app ») : finalité, catégories de personnes et de données, destinataires, transferts, durées, mesures de sécurité.
- Tâche humaine : voir §12.

## 4. Durée de conservation (art. 5.1.e)
Aucune durée légale propre à un coach pour ces données : **proposition [HYP.], à valider par Corentin** :
- Compte actif : pendant la durée du coaching.
- Données de santé (douleurs, poids, nutrition, photos de repas) : suppression ou anonymisation **3 mois après la fin du coaching** (ou plus tôt sur demande).
- Données de facturation/séances payées : obligations comptables propres au micro-entrepreneur (10 ans pour les pièces comptables côté Code de commerce — à vérifier ; hors app, dans son outil de facturation).
- Inactivité : si compte non utilisé 12 mois → proposer la suppression.
- Sauvegardes/exports : les inclure dans la durée (ne pas garder d'export JSON sur son PC sans limite).

## 5. Droits des personnes (art. 15 à 22) — réponse sous 1 mois (art. 12.3)
| Droit | Comment dans l'app / hors app |
|---|---|
| Accès (15) | Export JSON dans Profil (déjà au cahier des charges, §4.8). |
| Rectification (16) | Client modifie son profil ; le coach corrige le reste sur demande. |
| Effacement (17) | Bouton « Supprimer mes données santé » + suppression de compte par le coach (inclure **stockage des photos**, pas seulement la base). |
| Portabilité (20) | Même export JSON (format structuré, courant, lisible par machine). Vérifier qu'il inclut tout ce que le client a fourni. |
| Opposition / limitation (18, 21) | Via e-mail ; procédure à noter dans le registre. |
| Retrait du consentement (7.3) | Voir §1. |
- Obligatoire : une adresse de contact pour exercer les droits + vérification de l'identité du demandeur.
- Recommandé : un petit journal des demandes (date, réponse).

## 6. Sous-traitants et DPA (art. 28)
- **Supabase** : contrat de sous-traitance (DPA) obligatoire. Supabase publie un DPA en ligne (à chercher sur supabase.com/legal) ; **vérifier qu'il s'applique à l'offre gratuite et le conserver (date + version)**. [À VÉRIFIER, non confirmé cette session]
- **Netlify** : idem (DPA sur netlify.com/legal). Netlify sert surtout des fichiers statiques ; les données de santé ne passent normalement pas par ses serveurs (elles vont directement navigateur → Supabase), mais ses journaux peuvent contenir adresses IP. [HYP., à confirmer avec l'architecture finale]
- Choisir la région UE à la création du projet Supabase (non modifiable ensuite) et la noter dans le registre. [Tâche humaine]
- Lister Supabase et Netlify comme destinataires dans la page Confidentialité.
- Supabase plan gratuit : pas de sauvegarde automatique garantie, projet mis en pause après une période d'inactivité. [FAIT à revérifier] → impact sur la disponibilité/intégrité (art. 32) : prévoir un export régulier chiffré du coach (voir §8).

## 7. Transferts hors UE (chap. V, art. 44 et s.)
- Supabase et Netlify sont des sociétés américaines : même avec données stockées en UE, un accès depuis les États-Unis (support, administration) ou un CDN mondial peut constituer un transfert. Mécanisme à vérifier dans leur DPA : clauses contractuelles types et/ou certification Data Privacy Framework (à confirmer sur la liste officielle, https://www.dataprivacyframework.gov). [À FAIRE VÉRIFIER]
- Netlify CDN : le code de l'app (non personnel) peut être servi depuis des nœuds hors UE, et l'IP du visiteur y est vue. À mentionner dans la page Confidentialité.
- **Aucune donnée de santé dans les liens WhatsApp** (le message pré-rempli ne doit contenir que date/heure/lieu de séance, jamais douleur, poids, etc.) : WhatsApp (Meta) est un tiers choisi par le client. [Dans l'app]
- **Polices et librairies : les héberger soi-même** (pas de Google Fonts/CDN externes) pour éviter d'envoyer l'IP des clients à des tiers. [Dans l'app]
- Pas d'outil d'analyse/statistiques tiers en V1.

## 8. Sécurité (art. 32)
Dans l'app :
- RLS Supabase activé sur **toutes** les tables et le stockage : un client ne lit/écrit que ses lignes ; le coach seul voit tout. Tester avec un compte client (audit sécurité prévu).
- Clé `anon` publique acceptable **uniquement** si RLS est correct ; clé `service_role` jamais dans le code ni dans Git.
- **Code de 6 caractères = faible** : limiter les tentatives (blocage/délai), ne pas utiliser de codes devinables, forcer/inciter au changement dans Profil, expiration du code initial. [Recommandé fort]
- HTTPS uniquement (Netlify le fournit) ; bucket photos **privé**, URLs signées de courte durée.
- Pas de données de santé dans les journaux, URL, titres de notifications ou messages WhatsApp.
- Session persistante : déconnexion disponible ; rappeler de verrouiller son téléphone.
- Données locales hors connexion (séance en cours) : limiter à l'utile et les effacer après synchronisation et à la déconnexion.
- Photos de repas : retirer les métadonnées (EXIF/GPS) à l'envoi ; consigne « ne photographiez pas de personnes ».
- Mode local/données factices : jamais de vraies données de clients dedans.
Hors app (Corentin) :
- Mot de passe fort + double authentification sur les comptes Supabase, Netlify, e-mail, GitHub.
- Appareil du coach protégé (mot de passe, chiffrement disque) ; pas d'export JSON qui traîne.
- Export/sauvegarde périodique de la base (fréquence suggérée : mensuelle) stocké chiffré.

## 9. Violation de données (art. 33-34)
- Notification à la CNIL **dans les 72 h** après en avoir pris connaissance, si risque pour les personnes (probable avec des données de santé) ; information des personnes concernées si risque élevé. Téléservice : https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles
- Obligatoire : tenir un registre interne des violations (même sans notification).
- Procédure d'une page à rédiger (qui, quoi, comment : couper l'accès, changer les clés, prévenir les clients, notifier). Tâche humaine.

## 10. Mineurs
- Le texte français fixe à 15 ans l'âge du consentement seul pour les services en ligne (loi Informatique et Libertés, art. 45) [FAIT, à revérifier] ; pour des données de santé de mineurs, la prudence impose l'accord des parents.
- Recommandation [HYP.] : **V1 réservée aux majeurs**. Si un client mineur est accepté, hors app : accord écrit d'un représentant légal et compte géré avec lui ; Corentin le décide au cas par cas (point à risque).
- Dans l'app : case « J'ai 18 ans ou plus » (ou « j'ai l'accord de mon représentant légal ») dans l'écran de consentement.

## 11. HDS (hébergeur de données de santé) — s'applique-t-il ?
- Règle (Code de la santé publique, art. L.1111-8 et R.1111-8-8 s.) : l'hébergement de données de santé à caractère personnel **recueillies à l'occasion d'activités de prévention, de diagnostic, de soins ou de suivi social et médico-social** pour le compte de ceux qui les produisent ou du patient exige un hébergeur certifié HDS. Informations : https://esante.gouv.fr (rubrique HDS). [FAIT à revérifier]
- Analyse prudente [HYP., NON validée] : un coach sportif n'est pas un professionnel de santé, il ne fait ni diagnostic ni soin ; l'app sert à l'entraînement, pas à un suivi médical → l'obligation HDS **ne semble pas s'appliquer**. Mais : (a) les données sont bien « de santé » au sens du RGPD ; (b) la frontière devient floue si l'app sert à suivre des douleurs liées à une pathologie, une rééducation, ou si Corentin travaille avec des kinés/médecins ; (c) Supabase et Netlify ne sont pas, à ma connaissance, certifiés HDS (à vérifier).
- **À faire vérifier par un professionnel** (juriste santé / CNIL / ANS) avant d'accueillir des clients en rééducation ou envoyés par un professionnel de santé. Garde-fous en attendant : ne pas collecter de diagnostic, médicament, pathologie ou compte rendu médical ; champs libres avec avertissement (« pas d'informations médicales détaillées »).

## 12. AIPD (art. 35) et autres points à risque
- L'AIPD est requise si le traitement est « susceptible d'engendrer un risque élevé » ; les données sensibles sont un critère, le « grand volume » en est un autre (10-15 personnes = très petite échelle). [EST.] AIPD probablement non obligatoire, mais **à faire vérifier** ; faire malgré tout une mini-analyse de risques de 1 page (utile et peu coûteuse). Voir https://www.cnil.fr/fr/analyse-dimpact-relative-la-protection-des-donnees-aipd
- DPO : non obligatoire à cette échelle. [EST.]
- Cookies/traceurs : stockage local strictement nécessaire (session, séance en cours, préférences) → exempté de consentement s'il sert uniquement au fonctionnement ; aucun traceur publicitaire/analytique. À mentionner.
- Conflit avec un employeur / statut : sans objet identifié (activité indépendante). Activité réglementée : le titre de coach sportif impose une carte professionnelle (éducateur sportif) — hors RGPD, à vérifier séparément (service-public.fr). Éviter tout langage médical (« soigner », « traiter », « rééducation ») dans l'app.
- Assurance RC pro : vérifier qu'elle couvre l'activité numérique/incident de données. [Recommandé]

---

## A. À faire par Corentin (tâches humaines)
| # | Tâche | Durée estimée |
|---|---|---|
| 1 | Lire et valider/ajuster les durées de conservation (§4) | 15 min |
| 2 | Compléter le brouillon `page-confidentialite.md` ([À COMPLÉTER]) | 30 min |
| 3 | Créer le projet Supabase en **région UE** (Francfort/Paris) ; noter la région | 10 min |
| 4 | Récupérer, lire et archiver les DPA Supabase et Netlify (date + version) ; vérifier le mécanisme de transfert | 45 min |
| 5 | Remplir le registre des traitements (modèle CNIL, 1 fiche) | 45 min |
| 6 | Rédiger la procédure « violation de données » (1 page) + mini-analyse de risques | 45 min |
| 7 | Activer la double authentification (Supabase, Netlify, e-mail, GitHub) | 20 min |
| 8 | Faire relire page Confidentialité + texte de consentement + question HDS par un juriste/avocat ou service d'aide (ex. CCI, permanence juridique, ou CNIL pour questions générales) | 1-2 h + délai/coût à demander |
| 9 | Décider de la politique mineurs (V1 = majeurs ?) | 10 min |
| 10 | Informer chaque client à la création du compte (remise du lien Confidentialité) et garder trace | 5 min/client |
| 11 | Tester un exercice de droits (export JSON + suppression) avec un compte de test | 20 min |
| 12 | Vérifier son assurance RC pro | 20 min |
| 13 | Planifier l'export/sauvegarde mensuelle chiffrée | 15 min |

## B. À faire dans l'app (pour `developpeur`)
1. Écran de consentement au 1er lancement (voir `texte-consentement.md`) : case non pré-cochée, bouton désactivé tant que non cochée, stockage `consent_at`, `consent_version`, `user_id`.
2. Case d'âge (majeur) sur l'écran de consentement.
3. Mode « sans suivi santé » si refus (modules douleurs, poids, nutrition, photos masqués).
4. Page Confidentialité accessible depuis l'accueil public, l'écran de consentement et Profil (route publique).
5. Profil : voir mon consentement (date, version), retirer mon consentement, exporter mes données (JSON complet), supprimer mes données santé, demander la suppression du compte.
6. Suppression effective : base + stockage photos ; côté coach, bouton « supprimer définitivement un client » (avec confirmation).
7. Purge automatique ou rappel : données santé d'un client archivé > 3 mois (selon décision §4).
8. RLS sur toutes les tables et le bucket ; tests automatisés « un client ne lit pas les données d'un autre ».
9. Limitation des tentatives de connexion ; changement de code encouragé ; codes aléatoires non devinables.
10. Aucune donnée de santé dans les messages WhatsApp, URL, logs, noms de fichiers.
11. Polices et ressources auto-hébergées ; aucun script tiers ; pas d'analytics.
12. Suppression des métadonnées EXIF des photos ; bucket privé + URLs signées.
13. Effacement du stockage local à la déconnexion / après synchronisation.
14. Avertissement près des champs libres (commentaire, douleur) : « N'indiquez pas de diagnostic ni d'informations médicales détaillées. »
15. Journal minimal côté coach des consultations ? (optionnel, ne pas surcharger la V1).

> Rappel : cette liste repère des points d'attention. Aucune affirmation de conformité n'est faite ; la validation revient à Corentin et à un professionnel.
