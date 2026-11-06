// Outils coach du lot « bibliotheque » : exercices de l'app + vidéos de démonstration (voir docs/CONTRAT-OUTILS-COACH.md).
// Mêmes données et mêmes validations que l'app (creerApi) ; la bibliothèque de vidéos est celle de ctx.biblio.
import { z } from 'zod'
import { creerApi } from '../../../src/data/commun.js'
import { idYoutube } from '../../../src/domain/video.js'
import { ErreurService } from '../service.js'
import { norm, slug } from '../util.js'
import { chercherYoutube, DUREE_MAX } from '../youtube.js'
import { CHAMPS, appliquerPatch, filtrer } from '../exercices.js'
import { creerConfirmations } from './confirmer.js'
import { def } from './def.js'

const SCORE_MINI_AUTO = 40 // en dessous, une vidéo trouvée n'est pas rattachée automatiquement
const ref = (d) => z.string().trim().min(1).max(120).describe(d)
// Champs enrichis du Studio (fiche exercice) : mêmes règles que l'API de l'app. Une chaîne vide « » efface le champ.
const ENRICHIS = ['categorie', 'musclesPrincipaux', 'musclesSecondaires', 'materiel', 'niveau', 'consignes', 'erreursFrequentes', 'varianteFacile', 'varianteDifficile', 'tempo', 'reposConseille', 'notesPrivees']
const champsEnrichis = Object.fromEntries(ENRICHIS.map((k) => [k, CHAMPS[k].optional()]))
const extraire = (args) => Object.fromEntries(ENRICHIS.filter((k) => args[k] !== undefined).map((k) => [k, args[k]]))
const LIEN_INVALIDE = 'Seuls les liens YouTube sont acceptés (youtube.com/watch?v=…, youtu.be/…, /shorts/…).'

export function outilsBibliotheque(ctx) {
  const { service, backend, biblio, config = {}, now = () => Date.now(), fetchFn } = ctx
  const api = creerApi(backend, { now })
  const confirmations = creerConfirmations(now)

  /** Exercice désigné par son id ou son nom exact (sans accents/casse) ; sinon erreur qui liste les approchants. */
  async function trouver(reference) {
    const tous = await api.exercices.lister()
    const n = norm(reference)
    const ex = tous.find((e) => e.id === reference) || tous.find((e) => norm(e.nom) === n)
    if (ex) return ex
    const proches = tous.filter((e) => n && norm(e.nom).includes(n)).slice(0, 5).map((e) => `${e.nom} (${e.id})`)
    throw new ErreurService(`Exercice introuvable : « ${reference} ».${proches.length ? ` Approchants : ${proches.join(', ')}.` : ' Utilise lister_exercices.'}`, 'EXERCICE_INTROUVABLE')
  }

  /** Vidéo de l'exercice vue par le client : lien + statut dans la bibliothèque (propose / valide). */
  const videoDe = (ex) => {
    if (!ex.lienVideo) return null
    const entree = biblio.chercher(ex.nom).find((e) => e.video.url === ex.lienVideo)
    return { url: ex.lienVideo, statut: entree?.statut ?? 'propose', duree: entree?.video.duree ?? null, titre: entree?.video.titre ?? null }
  }
  const resume = (ex) => ({ id: ex.id, nom: ex.nom, description: ex.description ?? '', categories: ex.categories ?? [], ...extraire(ex), photo: !!ex.photo, video: videoDe(ex) })

  /** Recherche YouTube (≤ 2 recherches) et rattachement de la meilleure en « proposée ». Ne lève jamais. */
  async function proposerVideoAuto(ex, nomEn) {
    if (!config.youtubeCle) return { video: null, avertissement: 'YOUTUBE_API_KEY non configurée : aucune recherche de vidéo. Utilise rattacher_video avec un lien.' }
    try {
      const [meilleure] = await chercherYoutube(ex.nom, { cle: config.youtubeCle, chainesReconnues: config.chainesReconnues, fetchFn, nomEn })
      if (!meilleure || meilleure.score < SCORE_MINI_AUTO) return { video: null, avertissement: `Aucune vidéo de ${DUREE_MAX} s ou moins, intégrable et assez pertinente trouvée.` }
      const entree = biblio.proposer({ nom: ex.nom, ...meilleure })
      await api.exercices.modifier(ex.id, { lienVideo: entree.video.url })
      return { video: { url: entree.video.url, statut: entree.statut, duree: entree.video.duree, justification: entree.justification } }
    } catch (e) {
      return { video: null, avertissement: `Recherche de vidéo impossible (${e.message}). Réessaie plus tard.` }
    }
  }

  async function seancesUtilisant(id) {
    const noms = []
    for (const w of await api.workouts.lister()) {
      const ids = (w.blocs || []).flatMap((b) => [b.exerciceId, ...(b.exercices || []).map((x) => x.exerciceId)])
      if (ids.includes(id)) noms.push(w.nom)
    }
    return noms
  }

  return {
    lister_exercices: def('Liste les exercices de la bibliothèque (nom, id, catégories, vidéo et son statut : proposée / validée par le coach). `recherche` filtre sur le nom ; `sansVideo` ne garde que ceux sans vidéo.',
      z.object({ recherche: z.string().trim().max(120).optional(), sansVideo: z.boolean().optional(), categorie: z.string().max(40).optional(), muscle: z.string().max(40).optional(), materiel: z.string().max(40).optional(), niveau: CHAMPS.niveau.optional(), limite: z.number().int().min(1).max(200).optional() }).strict(),
      async ({ recherche, sansVideo, categorie, muscle, materiel, niveau, limite = 50 }) => {
        const n = recherche ? norm(recherche) : ''
        const tous = filtrer((await api.exercices.lister()).map((e) => ({ ...e, video: videoDe(e) })), { categorie, muscle, materiel, niveau })
          .filter((e) => (!n || norm(e.nom).includes(n)) && (!sansVideo || !e.lienVideo))
        return { total: tous.length, exercices: tous.slice(0, limite).map(resume) }
      }),

    creer_exercice: def(`Crée un exercice dans la bibliothèque. Obligatoire : nom. Facultatif : description, categories (ex. ["jambes"]), lienVideo (lien YouTube), et la fiche Studio : categorie, musclesPrincipaux, musclesSecondaires, materiel, niveau (debutant|intermediaire|confirme), consignes, erreursFrequentes, varianteFacile, varianteDifficile, tempo (« 3-1-1 »), reposConseille (secondes), notesPrivees (jamais vues du client). Sans lienVideo, cherche automatiquement une vidéo de démonstration (${DUREE_MAX} s maximum, intégrable, français d'abord) et rattache la meilleure en « proposée » (à valider avec valider_video). nomAnglais (ex. « goblet squat ») améliore la recherche de repli. Renvoie l'id.`,
      z.object({ nom: z.string().trim().min(1).max(120), description: z.string().max(1000).optional(), categories: z.array(z.string().trim().min(1).max(40)).max(10).optional(), lienVideo: z.string().url().max(300).optional(), nomAnglais: z.string().trim().max(120).optional(), ...champsEnrichis }).strict(),
      async ({ nom, description, categories, lienVideo, nomAnglais, ...enrichis }) => {
        if (lienVideo && !idYoutube(lienVideo)) throw new ErreurService(LIEN_INVALIDE, 'LIEN_INVALIDE')
        const existant = (await api.exercices.lister()).find((e) => norm(e.nom) === norm(nom))
        if (existant) throw new ErreurService(`L'exercice « ${existant.nom} » existe déjà (id ${existant.id}). Utilise modifier_exercice.`, 'EXISTE')
        let id = `ex-${slug(nom)}`
        if (await api.exercices.lire(id)) id += `-${now().toString(36).slice(-4)}`
        const ex = await api.exercices.creer(appliquerPatch({ id, nom, categories: categories ?? [], ...(description ? { description } : {}) }, extraire(enrichis)))
        let video = null
        let avertissement
        if (lienVideo) video = await service.rattacherVideo({ exercice: ex.nom, url: lienVideo })
        else ({ video, avertissement } = await proposerVideoAuto(ex, nomAnglais))
        return { id: ex.id, exercice: resume(await api.exercices.lire(ex.id)), video, ...(avertissement ? { avertissement } : {}) }
      }, { mutation: true }),

    modifier_exercice: def('Modifie un exercice (désigné par son nom exact ou son id) : nom, description, categories (remplace la liste), les champs de la fiche Studio (categorie, musclesPrincipaux, musclesSecondaires, materiel, niveau, consignes, erreursFrequentes, varianteFacile, varianteDifficile, tempo, reposConseille, notesPrivees ; « » ou [] efface) et/ou lienVideo (lien YouTube, rattaché en « proposée » ; refusé si le coach a déjà validé une autre vidéo).',
      z.object({ exercice: ref('Nom exact ou id de l\'exercice'), nom: z.string().trim().min(1).max(120).optional(), description: z.string().max(1000).optional(), categories: z.array(z.string().trim().min(1).max(40)).max(10).optional(), lienVideo: z.string().url().max(300).optional(), ...champsEnrichis }).strict()
        .refine((a) => Object.keys(a).length > 1, { message: 'Précise au moins un champ à modifier (nom, description, categories, lienVideo, fiche Studio)' }),
      async ({ exercice, nom, description, categories, lienVideo, ...enrichis }) => {
        const ex = await trouver(exercice)
        if (lienVideo && !idYoutube(lienVideo)) throw new ErreurService(LIEN_INVALIDE, 'LIEN_INVALIDE')
        if (nom && norm(nom) !== norm(ex.nom) && (await api.exercices.lister()).some((e) => norm(e.nom) === norm(nom))) throw new ErreurService(`Un exercice « ${nom} » existe déjà.`, 'EXISTE')
        const patch = { ...(nom ? { nom } : {}), ...(description !== undefined ? { description } : {}), ...(categories ? { categories } : {}) }
        const modifs = { ...patch, ...extraire(enrichis) }
        let maj = ex
        if (Object.keys(modifs).length) { maj = appliquerPatch(ex, modifs); await backend.ecrire('exercices', maj) } // appliquerPatch gère l'effacement des champs
        const video = lienVideo ? await service.rattacherVideo({ exercice: maj.nom, url: lienVideo }) : undefined
        return { id: ex.id, exercice: resume(await api.exercices.lire(ex.id)), ...(video ? { video } : {}) }
      }, { mutation: true }),

    supprimer_exercice: def('Supprime un exercice de la bibliothèque, EN DEUX TEMPS. 1er appel (sans jeton) : renvoie un résumé et un jeton, ne supprime rien. 2e appel avec le jeton : supprime. Refusé tant que l\'exercice est utilisé dans une séance (retire-le d\'abord). Ne rappelle avec le jeton qu\'après accord explicite du coach.',
      z.object({ exercice: ref('Nom exact ou id de l\'exercice'), jeton: z.string().regex(/^[0-9a-f]{32}$/).optional() }).strict(),
      async ({ exercice, jeton }) => {
        const ex = await trouver(exercice)
        const utilise = await seancesUtilisant(ex.id)
        if (utilise.length) throw new ErreurService(`« ${ex.nom} » est utilisé dans ${utilise.length} séance(s) : ${utilise.slice(0, 5).join(', ')}. Retire-le de ces séances d'abord.`, 'EXERCICE_UTILISE')
        const cle = `supprimer_exercice:${ex.id}`
        if (!jeton) return confirmations.demander(cle, `Supprimer l'exercice « ${ex.nom} » (${ex.id})${ex.lienVideo ? ' et son lien vidéo' : ''}`)
        if (!confirmations.verifier(cle, jeton)) throw new ErreurService('Jeton invalide ou expiré : rappelle avec exactement les mêmes arguments que le premier appel (avec le jeton), ou demande un nouveau jeton : redemande la suppression sans jeton.', 'JETON_INVALIDE')
        await backend.supprimer('exercices', ex.id)
        return { supprimee: true, id: ex.id, nom: ex.nom }
      }, { mutation: true }),

    valider_video: def('Valide la vidéo d\'un exercice (le coach l\'approuve : elle ne sera plus écrasée par Claude). Désigne l\'exercice par son nom exact ou son id. Avec `url` (lien YouTube choisi par le coach), remplace la vidéo actuelle par ce lien et le valide.',
      z.object({ exercice: ref('Nom exact ou id de l\'exercice'), url: z.string().url().max(300).optional() }).strict(),
      async ({ exercice, url }) => {
        const ex = await trouver(exercice)
        const entrees = biblio.chercher(ex.nom)
        const actuelle = entrees.find((e) => e.video.url === ex.lienVideo) ?? entrees[0]
        let entree
        if (url) {
          if (!idYoutube(url)) throw new ErreurService(LIEN_INVALIDE, 'LIEN_INVALIDE')
          if (actuelle) entree = await service.remplacerVideo(actuelle.id, { url })
          else {
            await service.rattacherVideo({ exercice: ex.nom, url })
            entree = await service.validerVideo(biblio.chercher(ex.nom)[0].id)
          }
        } else {
          if (!actuelle) throw new ErreurService(`« ${ex.nom} » n'a pas de vidéo à valider : utilise rattacher_video ou passe « url ».`, 'SANS_VIDEO')
          entree = await service.validerVideo(actuelle.id)
        }
        const longue = entree.video.duree != null && entree.video.duree > DUREE_MAX
        return { id: ex.id, exercice: ex.nom, video: { url: entree.video.url, statut: entree.statut, duree: entree.video.duree }, ...(longue ? { avertissement: `Cette vidéo dure ${entree.video.duree} s (plus de ${DUREE_MAX} s) : plus longue que la règle des démonstrations courtes.` } : {}) }
      }, { mutation: true })
  }
}
