import { describe, expect, it } from 'vitest'
import { markdownVersHtml } from '../../src/domain/markdown.js'

describe('markdownVersHtml', () => {
  it('échappe le HTML injecté (titres, listes, tableaux, liens)', () => {
    const html = markdownVersHtml('# <img src=x onerror=alert(1)>\n- <script>alert(1)</script>\n| <b>a</b> |\n| - |\n| <i>b</i> |\n[x"onmouseover="y](https://a.test/"onclick="z)')
    expect(html).not.toMatch(/<(img|script|b|i)[ >]/)
    expect(html).not.toMatch(/"on[a-z]+=/)
  })
  it('refuse les liens javascript:', () => {
    expect(markdownVersHtml('[x](javascript:alert(1))')).not.toContain('<a ')
  })
})
