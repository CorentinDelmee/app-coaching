# Écran de consentement (1er lancement) — BROUILLON À FAIRE RELIRE

> Version du texte : `2026-10-v1` (à stocker avec la date du consentement). Texte non validé juridiquement.
> Comportement : affiché après la 1re connexion, avant toute saisie. Case **non pré-cochée** ; bouton « Continuer » désactivé tant que les cases ne sont pas cochées. Lien « Confidentialité » vers la page publique `/confidentialite`.

---

## Titre
**Vos données, votre choix**

## Texte
Pour suivre votre entraînement, cette application enregistre :
- vos séances, charges et répétitions ;
- des **données de santé** : douleurs, poids, mensurations, habitudes alimentaires, photos de repas, vos réponses aux questionnaires.

Elles sont visibles par vous et par votre coach, **Corentin Delmée**, uniquement pour adapter votre programme. Elles sont stockées sur des serveurs situés dans l'Union européenne (Supabase). Elles ne sont ni vendues, ni utilisées pour de la publicité.

Vous pouvez à tout moment, depuis **Profil** : voir ou exporter vos données, retirer votre consentement, les supprimer.

[Lire la politique de confidentialité]

## Cases à cocher (toutes décochées par défaut)
- [ ] **J'ai 18 ans ou plus.**
- [ ] **J'accepte explicitement** que mes données de santé (douleurs, poids, mensurations, nutrition, photos de repas) soient enregistrées et utilisées par mon coach pour mon suivi, comme décrit dans la [politique de confidentialité].

## Boutons
- **Continuer** (actif seulement si les deux cases sont cochées)
- **Je préfère ne pas partager mes données de santé** → accès au programme et aux séances, sans douleurs / poids / nutrition (suivi à voir avec mon coach).

## Note d'implémentation (non affichée)
- Enregistrer : `user_id`, `consent_version`, `consent_at`, choix (complet / sans santé).
- Retrait possible dans Profil, aussi simple que l'acceptation.
- Si le texte change : nouvelle version, nouvel écran.
