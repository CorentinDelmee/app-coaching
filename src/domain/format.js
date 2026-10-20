// Mise en forme FR (nombres, durées, ordinaux).

/** 272000 ms -> « 4:32 » ; au-delà d'une heure -> « 1:02:03 ». */
export function formaterChrono(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** 12.5 -> « 12,5 » */
export const formaterNombre = (n) => String(n).replace('.', ',')

/** 70 -> « 70 € » */
export const formaterEuros = (n) => `${formaterNombre(Math.round(n * 100) / 100)} €`

/** 1 -> « 1re », 2 -> « 2e » (séance). */
export const ordinalFeminin = (n) => (n === 1 ? '1re' : `${n}e`)

export const pluriel = (n, un, plusieurs) => (n > 1 ? plusieurs : un)
