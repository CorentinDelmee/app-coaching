// Magasins de données du serveur. Chacun expose le « backend » attendu par creerApi (src/data/commun.js) :
// la validation, les règles et le format sont donc EXACTEMENT ceux de l'app (une seule vérité).
//   - fichier  : démo. Un fichier JSON au même format que le stockage local de l'app (relu à chaque appel :
//                le serveur REST et le serveur MCP (2 processus) partagent ainsi le même fichier).
//   - supabase : production. Clé « service » (contourne les RLS) lue dans l'environnement, jamais envoyée au navigateur.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { genererDemo } from '../../src/data/demo/index.js'
import { depuisLigne, versLigne } from '../../src/data/adapters/supabase.js'
import { ENTITES } from '../../src/data/entites.js'

export function creerStoreFichier(fichier, now = () => Date.now()) {
  mkdirSync(dirname(fichier), { recursive: true })
  const lire = () => {
    if (!existsSync(fichier)) ecrire(genererDemo(now()))
    return JSON.parse(readFileSync(fichier, 'utf8'))
  }
  // Écriture atomique : fichier temporaire puis renommage.
  const ecrire = (etat) => {
    const tmp = `${fichier}.tmp`
    writeFileSync(tmp, JSON.stringify(etat, null, 1))
    renameSync(tmp, fichier)
  }
  return {
    mode: 'fichier',
    async tout(entite) { return structuredClone(lire()[entite] || []) },
    async un(entite, id) { return structuredClone((lire()[entite] || []).find((x) => x.id === id) || null) },
    async ecrire(entite, obj) {
      const etat = lire()
      const liste = (etat[entite] ||= [])
      const i = liste.findIndex((x) => x.id === obj.id)
      if (i >= 0) liste[i] = structuredClone(obj)
      else liste.push(structuredClone(obj))
      ecrire(etat)
    },
    async supprimer(entite, id) {
      const etat = lire()
      etat[entite] = (etat[entite] || []).filter((x) => x.id !== id)
      ecrire(etat)
    }
  }
}

/** Production : mêmes tables que l'app (supabase/schema.sql), accès par clé service. Non testé sans projet Supabase réel. */
export async function creerStoreSupabase({ url, cleService }) {
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, cleService, { auth: { persistSession: false } })
  const verif = ({ data, error }) => { if (error) throw new Error(`Supabase : ${error.message}`); return data }
  return {
    mode: 'supabase',
    async tout(entite) { return verif(await sb.from(ENTITES[entite].table).select('*')).map((r) => depuisLigne(entite, r)) },
    async un(entite, id) {
      const r = verif(await sb.from(ENTITES[entite].table).select('*').eq('id', id).maybeSingle())
      return r ? depuisLigne(entite, r) : null
    },
    async ecrire(entite, obj) { verif(await sb.from(ENTITES[entite].table).upsert(versLigne(entite, obj))) },
    async supprimer(entite, id) { verif(await sb.from(ENTITES[entite].table).delete().eq('id', id)) }
  }
}
