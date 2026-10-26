import { describe, expect, it } from 'vitest'
import { verifierCleApi } from '../../scripts/garde-cle-api.mjs'

describe('garde de build VITE_API_KEY', () => {
  it('bloque le build de production si la clé est définie', () => {
    expect(() => verifierCleApi({ command: 'build', mode: 'production', env: { VITE_API_KEY: 'x' } })).toThrow(/BUILD BLOQUÉ/)
  })
  it('laisse passer le développement et un build sans clé', () => {
    expect(() => verifierCleApi({ command: 'serve', mode: 'development', env: { VITE_API_KEY: 'x' } })).not.toThrow()
    expect(() => verifierCleApi({ command: 'build', mode: 'production', env: {} })).not.toThrow()
  })
})
