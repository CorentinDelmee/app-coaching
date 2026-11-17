// Génère docs/import-depart.json (80 exercices, sans clients fictifs) depuis les données de démo.
// Usage : node docs/generer-import-depart.mjs          (écrit le JSON)
//         node docs/generer-import-depart.mjs --sql    (affiche le SQL des 2 questionnaires par défaut)
import { writeFileSync } from 'node:fs'
import { EXERCICES } from '../src/data/demo/exercices.js'
import { QUESTIONNAIRES } from '../src/data/demo/questionnaires.js'

if (process.argv.includes('--sql')) {
  const q = (s) => s.replace(/'/g, "''")
  for (const x of QUESTIONNAIRES) {
    console.log(`insert into questionnaires (id, client_id, data) values ('${x.id}', null, '${q(JSON.stringify(x))}'::jsonb)\non conflict (id) do update set data = excluded.data;`)
  }
} else {
  const doc = { format: 'cdc-coaching/1', exporteLe: '2026-10-20T00:00:00.000Z', exercices: EXERCICES, workouts: [], programmes: [] }
  writeFileSync(new URL('./import-depart.json', import.meta.url), JSON.stringify(doc, null, 2) + '\n')
  console.log(`${EXERCICES.length} exercices écrits dans docs/import-depart.json`)
}
