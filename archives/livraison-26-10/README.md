# App coaching — livraison du 26/10/2026

Trois chantiers, tous fusionnés dans `main` et testés par un testeur indépendant (417 tests verts, build OK).

## Ordre de lecture conseillé
1. **A. Alignement M5** : ouvrir `docs/captures-m5/comparaison.html` (M5 / avant / après, côte à côte),
   puis lancer l'app (`lancer.cmd`, compte `fabien.vincent` / `DEMO2024`).
   - Jaune = **`#F2E27A`** (l'accent « Jaune pâle » de la M5, celui que tu avais choisi), texte posé dessus `#26230A`.
   - Surbrillance = accent à 22 % dans la surface + trait d'accent 2 px (M5).
   - Tokens M5 : source unique `src/styles/tokens.css` (miroir GSAP : `src/anim/constantes.js`).
   - Écarts gardés volontairement (contraste, choix déjà refusés) : `docs/ECARTS-M5.md`.
2. **B. Google Agenda → app client** : `docs/GOOGLE-AGENDA.md` (configuration Google Cloud pas à pas, sans identifiant réel).
   Démo : espace coach `/coach` (`corentin` / `COACH2026`) → « Agenda Google » → « Synchroniser maintenant »,
   puis la séance « Coaching Fabien Vincent » apparaît dans la case Coaching de Fabien.
   Règle : titre « Coaching » + nom du client, sans tenir compte des majuscules ni des accents ; homonymes et noms inconnus remontent en alerte.
3. **C. Back-end + serveur MCP** : `serveur/README.md`. Claude crée une séance pour le bon client, avec vidéos.
   Démo de bout en bout : `node serveur/tests/e2e-seance.mjs --navigateur`.
   Bibliothèque : 51 exercices avec vidéos YouTube vérifiées (`livraison-26-10/bibliotheque-videos.md`), à valider dans l'écran coach « Vidéos ».

## Ce que tu devras faire toi-même (rien n'a été connecté)
- Google Cloud + OAuth : suivre `docs/GOOGLE-AGENDA.md` (encadré « jour J » en tête).
- Clé `COACH_API_KEY` dans `serveur/.env` (au moins 16 caractères) et `.mcp.json` d'après `serveur/mcp.json.exemple`.
- Facultatif : `YOUTUBE_API_KEY` pour la recherche automatique de vidéos (sinon : bibliothèque locale).
- Valider ou remplacer les vidéos proposées (chaînes peu connues listées dans `bibliotheque-videos.md`).

## Limites connues
Jamais testé contre un vrai Google, un vrai Supabase ni un vrai téléphone. La bibliothèque reste en fichier JSON.
Une séance Google n'apparaît dans la case Coaching que si aucune séance plus proche n'existe déjà.
