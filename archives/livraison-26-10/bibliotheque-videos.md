# Bibliothèque d'exercices et vidéos de démonstration (26/10/2026)

51 exercices, tous du catalogue de l'app (`docs/import-depart.json`), chacun avec une vidéo YouTube principale et 0 à 1 alternative.
Données : `bibliotheque-videos.json` (statut `propose` : à valider par Corentin avant diffusion aux clients).

## Méthode de sélection
1. Recherche YouTube par exercice (termes français d'abord, anglais si rien de satisfaisant).
2. Critères : démonstration de l'exercice exact, technique claire, chaîne reconnue (média fitness, fédération, organisme de certification, kinésithérapeutes, coachs établis), préférence français puis anglais, pas de contenu douteux.
3. **Vérification (fait vérifié)** : chaque URL a été contrôlée par l'oEmbed YouTube le 2026-10-26 (renvoie titre et chaîne). Trois liens candidats renvoyaient 404 et ont été écartés.
4. Le choix repose sur le titre et la chaîne : **les vidéos n'ont pas été visionnées**. À regarder par Corentin (au moins celles marquées « à valider »).

## Limites connues
- **Durées non vérifiables** : `duree_s` vaut `null` partout (les outils disponibles ne donnent pas la durée). Le critère « < 2 min » n'est donc pas garanti ; à compléter à l'import (ex. API YouTube Data, champ `contentDetails.duration`).
- Les vidéos peuvent être supprimées ou passées en privé : prévoir un contrôle périodique (oEmbed).
- Embarquer une vidéo dans l'app dépend du choix de l'uploader (embedding autorisé) : non testé.
- Langue anglaise (pas de FR satisfaisant trouvé) : hip thrust, chaise murale, dead bug, bird dog, russian twist, mountain climbers, jumping jacks, box jump.
- Chaînes peu connues à valider : endur activ, Lepape, NATURAZONE, Global Fitness Club, Lucien Faber, KJ - Support Team.
- Soulevé de terre jambes tendues : la vidéo montre la version roumaine (genoux légèrement fléchis). Le soulevé de terre FFForce est de la force athlétique, probablement long.
- Alias et muscles rédigés par l'agent (non issus des vidéos). Les ids suivent `ex-<slug>` ; rapprocher par `nom` si le slug de l'app diffère.

## Tableau (vidéo principale)
| Exercice | Chaîne | Langue | URL |
|---|---|---|---|
| Squat | ELLE | fr | https://www.youtube.com/watch?v=EXFBExFRTBY |
| Squat gobelet | Your House Fitness | fr | https://www.youtube.com/watch?v=mKREc_xl_j8 |
| Squat bulgare | Olymp'Fit | fr | https://www.youtube.com/watch?v=eCJxHKDXBqk |
| Fentes avant | ELLE | fr | https://www.youtube.com/watch?v=osWJEjE4gb0 |
| Fentes marchées | endur activ | fr | https://www.youtube.com/watch?v=Frfms16Fv4I |
| Fentes arrière | NATURAZONE | fr | https://www.youtube.com/watch?v=Zz8DrsAUIZo |
| Pont fessier | Lina Hammouche | fr | https://www.youtube.com/watch?v=2ICbrXLD80A |
| Hip thrust | Dr. Carl Baird | en | https://www.youtube.com/watch?v=UmY5lVwpycE |
| Soulevé de terre jambes tendues | Your House Fitness | fr | https://www.youtube.com/watch?v=pf2rQT3LvIQ |
| Soulevé de terre | FFForce | fr | https://www.youtube.com/watch?v=uCWKWTP_Htw |
| Chaise murale | Medbridge | en | https://www.youtube.com/watch?v=cWTZ8Am1Ee0 |
| Squat sauté | Femme Fitness | fr | https://www.youtube.com/watch?v=K_a0DHvVfaE |
| Pompes | MUST COACH | fr | https://www.youtube.com/watch?v=hR6_6IdiYv4 |
| Pompes sur les genoux | 15-Minute Challenge | fr | https://www.youtube.com/watch?v=SWUw2epT8P4 |
| Développé couché | Olymp'Fit | fr | https://www.youtube.com/watch?v=HBXn_SAlPw0 |
| Développé épaules | Olymp'Fit | fr | https://www.youtube.com/watch?v=CE9KiCPFw0E |
| Élévations latérales | Olymp'Fit | fr | https://www.youtube.com/watch?v=q_DYeb_daeY |
| Dips sur banc | P4P Français | fr | https://www.youtube.com/watch?v=iBZvlLlWONY |
| Tractions | Olymp'Fit | fr | https://www.youtube.com/watch?v=z7CCVwDfn0I |
| Rowing haltère un bras | Olymp'Fit | fr | https://www.youtube.com/watch?v=2P2TyrYyTmU |
| Rowing élastique | Drey.coaching | fr | https://www.youtube.com/watch?v=8A7YKYByzwE |
| Face pull | Maxime Clergeau | fr | https://www.youtube.com/watch?v=JiMQk5X9-q8 |
| Curl biceps haltères | FizzUp | fr | https://www.youtube.com/watch?v=u9gpe8CHfjU |
| Planche | MUST COACH | fr | https://www.youtube.com/watch?v=qRUioGwKRCY |
| Planche latérale | Casa Del Mouv' | fr | https://www.youtube.com/watch?v=_H9lCamSHR0 |
| Dead bug | NASM | en | https://www.youtube.com/watch?v=bxn9FBrt4-A |
| Bird dog | NASM | en | https://www.youtube.com/watch?v=ZdAHe9_HeEw |
| Crunch | Decathlon FR | fr | https://www.youtube.com/watch?v=CdDGyI9l0R0 |
| Russian twist | Howcast | en | https://www.youtube.com/watch?v=wkD8rjkodUI |
| Mountain climbers | Gymless Fitness | en | https://www.youtube.com/watch?v=PBDd7YjBv5I |
| Pallof press | Olymp'Fit | fr | https://www.youtube.com/watch?v=Pz95Wgyt9MA |
| Hollow body | Coach Me App | fr | https://www.youtube.com/watch?v=EJjsvXVZU54 |
| Burpees | Doctissimo | fr | https://www.youtube.com/watch?v=4YPWd8z090A |
| Jumping jacks | Global Fitness Club | en | https://www.youtube.com/watch?v=RKwqhOcHLbE |
| Corde à sauter | JB Jumpingggg | fr | https://www.youtube.com/watch?v=8hS-HD19qjA |
| Kettlebell swing | Jack Vanbergen | fr | https://www.youtube.com/watch?v=RkcZ1BzYl_M |
| Box jump | The Progrm | en | https://www.youtube.com/watch?v=5pN5N2AOo1Y |
| Thruster | Lucien Faber | fr | https://www.youtube.com/watch?v=RfPBzUcMluE |
| Wall ball | Jack Vanbergen | fr | https://www.youtube.com/watch?v=Z7RDxaxY_QU |
| Cat-cow | Gabriel Augusto | fr | https://www.youtube.com/watch?v=r43PNCct6Yw |
| Rotation thoracique | PhysioVichy | fr | https://www.youtube.com/watch?v=1v-50J-OzEk |
| Étirement fléchisseurs de hanche | Clinique Physio Guindon | fr | https://www.youtube.com/watch?v=WtTAT6lSm3E |
| Étirement ischio-jambiers | Clinique Masseo Québec | fr | https://www.youtube.com/watch?v=wEuAv8wOPVo |
| Pigeon | Gabriel Augusto | fr | https://www.youtube.com/watch?v=fWQHAYfMTCQ |
| Mobilité de cheville au mur | Romain Katchavenda | fr | https://www.youtube.com/watch?v=AICUctv5Ufg |
| Chien tête en bas | YOGALINE by Stéphanie | fr | https://www.youtube.com/watch?v=w92w5LONfrk |
| Posture de l'enfant | SIKANA Français | fr | https://www.youtube.com/watch?v=W2hM6cqI6fs |
| Montées sur banc | Your House Fitness | fr | https://www.youtube.com/watch?v=sSOz4NMosWA |
| Tirage vertical | BeComplete | fr | https://www.youtube.com/watch?v=dOukQ7QBSQs |
| Position du squat profond | Jack's Team - Strongfit & TMS | fr | https://www.youtube.com/watch?v=2d2XFkbhpI0 |
| Rameur | Jack Vanbergen | fr | https://www.youtube.com/watch?v=GG_z7CnOWMI |

Alternatives, justification, muscles, matériel et alias : voir le JSON.

## Non couverts (catalogue app sans vidéo)
Presse à cuisses, leg curl, leg extension, mollets debout, pompes déclinées/diamant, développé incliné, écartés, dips aux barres, tractions assistées, rowing barre, tirage horizontal, curl marteau, oiseau, superman, gainage dynamique/ours, relevé de jambes, roue abdominale, levée de genoux suspendu, skipping, talons-fesses, course, vélo, corde ondulatoire, shadow boxing, cercles d'épaules, extension triceps : à traiter dans une seconde vague.
