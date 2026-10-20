// Consentement explicite aux données de santé (texte : docs/texte-consentement.md, version ci-dessous).
// Enregistré dans le profil : `consentementLe` (date) + `preferences.consentement = { version, sante }`.
// sante:false = « je préfère ne pas partager » : programme et séances oui, douleurs / poids / nutrition / questionnaires non.

export const VERSION_CONSENTEMENT = '2026-10-v1'

export const TEXTE_CONSENTEMENT = {
  titre: 'Vos données, votre choix',
  intro: 'Pour suivre votre entraînement, cette application enregistre :',
  liste: [
    'vos séances, charges et répétitions ;',
    'des données de santé : douleurs, poids, mensurations, habitudes alimentaires, photos de repas, vos réponses aux questionnaires.'
  ],
  destinataires: 'Elles sont visibles par vous et par votre coach, Corentin Delmée, uniquement pour adapter votre programme. Elles sont stockées sur des serveurs situés dans l\'Union européenne (Supabase). Elles ne sont ni vendues, ni utilisées pour de la publicité.',
  droits: 'Vous pouvez à tout moment, depuis Profil : voir ou exporter vos données, retirer votre consentement.',
  cases: [
    'J\'ai 18 ans ou plus.',
    'J\'accepte explicitement que mes données de santé (douleurs, poids, mensurations, nutrition, photos de repas) soient enregistrées et utilisées par mon coach pour mon suivi, comme décrit dans la politique de confidentialité.'
  ],
  continuer: 'Continuer',
  refuser: 'Je préfère ne pas partager mes données de santé',
  refusExplication: 'Vous gardez l\'accès au programme et aux séances, sans douleurs, poids ni nutrition. À voir avec votre coach.'
}

/** Le coach n'a pas à consentir ; un client doit avoir répondu à la version courante du texte. */
export function consentementRepondu(user) {
  if (!user || user.role === 'coach') return true
  return !!user.consentementLe && user.preferences?.consentement?.version === VERSION_CONSENTEMENT
}

/** Accès aux rubriques santé (questionnaires, suivi) : coach oui ; client seulement s'il a accepté. */
export function accesSante(user) {
  if (!user) return false
  if (user.role === 'coach') return true
  return consentementRepondu(user) && user.preferences?.consentement?.sante === true
}

/** Patch de profil à enregistrer pour un choix (`sante` true = accepté, false = refus des données de santé). */
export function patchConsentement(user, sante, now) {
  return {
    consentementLe: now,
    preferences: { ...(user.preferences || {}), consentement: { version: VERSION_CONSENTEMENT, sante: !!sante } }
  }
}
