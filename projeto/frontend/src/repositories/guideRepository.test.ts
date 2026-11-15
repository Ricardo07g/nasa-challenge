import { describe, expect, it } from 'vitest'
import { createGuideRepository, guideRepository } from './guideRepository'

describe('guideRepository', () => {
  it('lê idioma e slug do caminho do arquivo', () => {
    const repo = createGuideRepository({
      '../content/guia/pt/veranico.md': '# pt',
      '../content/guia/en/veranico.md': '# en',
    })
    expect(repo.files()).toEqual([
      { lang: 'pt', slug: 'veranico', raw: '# pt' },
      { lang: 'en', slug: 'veranico', raw: '# en' },
    ])
  })

  it('ignora arquivo fora do padrão', () => {
    const repo = createGuideRepository({ '../content/guia/fr/x.md': 'x', '../content/guia/pt/README.txt': 'y' })
    expect(repo.files()).toEqual([])
  })

  it('o repository real carrega os arquivos do build', () => {
    expect(Array.isArray(guideRepository.files())).toBe(true)
  })
})
