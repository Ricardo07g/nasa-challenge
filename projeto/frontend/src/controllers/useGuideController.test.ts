import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { GuideArticle, GuideSummary } from '../models/guide'
import { createGuideService } from '../services/guideService'
import { providers } from '../test/providers'
import { useGuideArticleController, useGuideController } from './useGuideController'

const summary = (slug: string, title: string, theme: GuideSummary['theme']): GuideSummary => ({
  slug,
  title,
  theme,
  draft: false,
  plant: null,
})
const pt = [summary('sorgo', 'Sorgo', 'cultures'), summary('veranico', 'Veranico', 'climate')]
const en = [summary('sorgo', 'Sorghum', 'cultures')]
const article: GuideArticle = { ...pt[0], blocks: [] }

const real = createGuideService({ files: () => [] })
const guide = {
  ...real,
  list: vi.fn((lang: string) => (lang === 'pt' ? pt : en)),
  get: vi.fn((_lang: string, slug: string) => (slug === 'sorgo' ? article : null)),
}

describe('useGuideController', () => {
  it('agrupa por tema no idioma atual', () => {
    const { result } = renderHook(() => useGuideController({ guide }), { wrapper: providers('/guia', 'pt') })
    expect(result.current.groups.map((g) => g.theme)).toEqual(['cultures', 'climate'])
    expect(result.current.count).toBe(2)
  })

  it('usa o idioma en', () => {
    const { result } = renderHook(() => useGuideController({ guide }), { wrapper: providers('/guia', 'en') })
    expect(result.current.groups[0].articles[0].title).toBe('Sorghum')
  })

  it('a busca filtra pelo título', () => {
    const { result } = renderHook(() => useGuideController({ guide }), { wrapper: providers('/guia', 'pt') })
    act(() => result.current.setQuery('vera'))
    expect(result.current.groups.map((g) => g.theme)).toEqual(['climate'])
    expect(result.current.count).toBe(1)
    act(() => result.current.setQuery('zzz'))
    expect(result.current.count).toBe(0)
  })
})

describe('useGuideArticleController', () => {
  it('abre o artigo pelo slug', () => {
    const { result } = renderHook(() => useGuideArticleController('sorgo', { guide }), { wrapper: providers('/guia/sorgo') })
    expect(result.current.article).toBe(article)
  })

  it('slug que não existe dá null', () => {
    const { result } = renderHook(() => useGuideArticleController('nada', { guide }), { wrapper: providers('/guia/nada') })
    expect(result.current.article).toBeNull()
  })
})
