// Prépare videos.json (nom d'exercice → vidéo) et télécharge les miniatures YouTube.
// Usage : node programmes/ludo/pdf/preparer-videos.mjs <export lister_exercices.json>
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const biblio = JSON.parse(readFileSync(process.argv[2], 'utf8')).exercices;
const prog = JSON.parse(readFileSync(join(ici, '..', 'programme.json'), 'utf8'));

const noms = new Set();
for (const s of prog.semaines[0].seances)
  for (const b of s.blocs)
    (b.superset?.exercices || b.circuit?.exercices || [b.exercice]).forEach((e) => noms.add(e.nom));

const idYoutube = (url) => url.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/)?.[1];
mkdirSync(join(ici, 'miniatures'), { recursive: true });

const videos = {};
for (const nom of noms) {
  const ex = biblio.find((e) => e.nom === nom);
  const id = ex?.video?.url && idYoutube(ex.video.url);
  if (!id) { console.log('SANS VIDÉO :', nom); continue; }
  videos[nom] = { url: ex.video.url, id, statut: ex.video.statut };
  const fichier = join(ici, 'miniatures', `${id}.jpg`);
  if (!existsSync(fichier)) {
    const r = await fetch(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
    if (!r.ok) { console.log('MINIATURE KO', r.status, nom); continue; }
    writeFileSync(fichier, Buffer.from(await r.arrayBuffer()));
  }
}
writeFileSync(join(ici, 'videos.json'), JSON.stringify(videos, null, 2) + '\n');
console.log(Object.keys(videos).length, 'vidéos /', noms.size, 'exercices');
