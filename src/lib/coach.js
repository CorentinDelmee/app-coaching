// Contact WhatsApp du coach. Numéro (format international, sans « + ») dans VITE_COACH_WHATSAPP ; s'il est absent,
// le lien s'ouvre quand même et WhatsApp laisse choisir le contact (repli). Jamais de numéro dans le code.
import { lienWhatsApp } from '../domain/coaching.js'

export const numeroCoach = () => import.meta.env?.VITE_COACH_WHATSAPP || ''
export const lienCoach = (texte) => lienWhatsApp(numeroCoach(), texte)
