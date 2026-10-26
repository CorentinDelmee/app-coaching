import { describe, expect, it } from 'vitest'
import { aleatoire, champsStockes, corsPour, defiPkce, egalConstant, hmacHex } from '../../supabase/functions/_shared/securite.js'

describe('securite des Edge Functions', () => {
  it('egalConstant : vrai seulement pour deux chaînes identiques non vides, quelles que soient les longueurs', async () => {
    expect(await egalConstant('abc', 'abc')).toBe(true)
    expect(await egalConstant('abc', 'abd')).toBe(false)
    expect(await egalConstant('abc', 'abcd')).toBe(false)
    expect(await egalConstant('', '')).toBe(false)
    expect(await egalConstant(undefined, 'a')).toBe(false)
  })
  it('hmacHex : valeur connue (RFC 4231, cas 2)', async () => {
    expect(await hmacHex('Jefe', 'what do ya want for nothing?')).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843')
  })
  it('PKCE S256 : vecteur de la RFC 7636', async () => {
    expect(await defiPkce('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })
  it('aleatoire : unique et sans caractères d\'URL gênants', () => {
    expect(aleatoire()).not.toBe(aleatoire())
    expect(aleatoire(48)).toMatch(/^[A-Za-z0-9_-]+$/)
  })
  it('CORS : seule APP_ORIGIN est reflétée', () => {
    const req = (o) => new Request('https://x.test', { headers: o ? { Origin: o } : {} })
    expect(corsPour(req('https://app.test'), 'https://app.test')['Access-Control-Allow-Origin']).toBe('https://app.test')
    expect(corsPour(req('https://evil.test'), 'https://app.test')['Access-Control-Allow-Origin']).toBeUndefined()
    expect(corsPour(req('https://app.test'), '')['Access-Control-Allow-Origin']).toBeUndefined()
  })
  it('champsStockes : ni description ni invités ni champs inconnus', () => {
    const r = champsStockes({ id: 'e1', titre: 'Coaching A', date: '2026-10-27', heure: '18:00', lieu: 'domicile', description: 'secret', attendees: [{ email: 'a@b.c' }], candidats: ['x'] })
    expect(r).toEqual({ id: 'e1', titre: 'Coaching A', date: '2026-10-27', heure: '18:00', lieu: 'domicile' })
  })
})
