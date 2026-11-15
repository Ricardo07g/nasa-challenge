import { act, renderHook, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { GuideArticle, GuideSummary } from '../models/guide'
import type { PontoAvisos } from '../models/avisos'
import type { FieldFact, GuideFieldService } from '../services/guideFieldService'
import { createGuideService } from '../services/guideService'
import { parseMarkdown } from '../services/markdownService'
import type { SpeechService } from '../services/speechService'
import { I18nProvider } from '../i18n/I18nProvider'
import { LocationProbe, providers } from '../test/providers'
import { useGuideArticleController, useGuideController } from './useGuideController'

const summary = (slug: string, title: string, theme: GuideSummary['theme'], extra: Partial<GuideSummary> = {}): GuideSummary => ({
  slug,
  title,
  summary: '',
  theme,
  draft: false,
  plant: null,
  minutes: 1,
  related: [],
  ...extra,
})
const pt = [
  summary('sorgo', 'Sorgo', 'cultures', { summary: 'Aguenta seca.' }),
  summary('como-evitar-erosao', 'Como evitar erosão', 'soil', { summary: 'A chuva leva a terra.', related: ['veranico'] }),
  summary('raio-x', 'Como ler o raio-X', 'climate'),
  summary('veranico', 'Veranico', 'climate', { summary: 'Dias seguidos sem chuva.' }),
]
const en = [summary('sorgo', 'Sorghum', 'cultures')]
const blocks = parseMarkdown(
  '## Em uma frase\n\nErosão é a chuva levando a terra.\n\n## Por que importa\n\nTexto.\n\n## Na sua lavoura\n\nVeja.\n\n## Fontes\n\n- x',
)
const erosion: GuideArticle = { ...pt[1], blocks }

const real = createGuideService({ files: () => [] })
const guide = {
  ...real,
  list: vi.fn((lang: string) => (lang === 'pt' ? pt : en)),
  get: vi.fn((_lang: string, slug: string) => (slug === 'como-evitar-erosao' ? erosion : null)),
}

const speech = (): SpeechService => ({ isSupported: () => true, speak: vi.fn(), stop: vi.fn() })

const heavyRain: FieldFact = {
  kind: 'heavyRain',
  data: { media_dias_ano: 0.25, dias: 5, total_anos: 20, limite_mm: 50, fonte: 'gpm_imerg' },
}

function fieldService(saved: PontoAvisos | null = null, fact: FieldFact | null = heavyRain): GuideFieldService & { fact: ReturnType<typeof vi.fn> } {
  return { savedPoint: vi.fn(() => saved), fact: vi.fn(async (_slug, point) => (point ? fact : null)) }
}
const location = () => screen.getByTestId('location').textContent

describe('useGuideController (início do Guia, tela 8)', () => {
  it('as pílulas com a contagem e o "Comece por aqui" só em "Todos"', () => {
    const { result } = renderHook(() => useGuideController({ guide }), { wrapper: providers('/guia', 'pt') })

    expect(result.current.themes).toEqual([
      { key: 'all', count: 4 },
      { key: 'cultures', count: 1 },
      { key: 'planting', count: 0 },
      { key: 'soil', count: 1 },
      { key: 'climate', count: 2 },
      { key: 'safety', count: 0 },
    ])
    expect(result.current.featured.map((a) => a.slug)).toEqual(['raio-x'])
    expect(result.current.groups.map((g) => g.theme)).toEqual(['cultures', 'soil', 'climate'])
    expect(result.current.searching).toBe(false)
  })

  it('o filtro mostra só o tema escolhido, sem o "Comece por aqui", e vai para a URL', () => {
    const { result } = renderHook(() => useGuideController({ guide }), { wrapper: providers('/guia', 'pt') })

    act(() => result.current.setTheme('climate'))

    expect(result.current.filters.theme).toBe('climate')
    expect(result.current.groups).toEqual([{ theme: 'climate', articles: [pt[2], pt[3]] }])
    expect(result.current.featured).toEqual([])
    expect(location()).toBe('/guia?tema=clima')
  })

  it('a busca acha sem acento, marca o trecho e esconde os temas', () => {
    const { result } = renderHook(() => useGuideController({ guide }), { wrapper: providers('/guia', 'pt') })

    act(() => result.current.setQuery('erosao'))

    expect(result.current.searching).toBe(true)
    expect(result.current.results.map((r) => r.article.slug)).toEqual(['como-evitar-erosao'])
    expect(result.current.results[0].title).toEqual([
      { text: 'Como evitar ', mark: false },
      { text: 'erosão', mark: true },
    ])
    expect(location()).toBe('/guia?q=erosao')
  })

  it('a busca também olha o resumo; sem resultado, lista vazia (a tela mostra as sugestões)', () => {
    const { result } = renderHook(() => useGuideController({ guide }), { wrapper: providers('/guia', 'pt') })

    act(() => result.current.setQuery('SECA'))
    expect(result.current.results.map((r) => r.article.slug)).toEqual(['sorgo'])
    expect(result.current.results[0].summary.some((p) => p.mark)).toBe(true)

    act(() => result.current.setQuery('zzz'))
    expect(result.current.results).toEqual([])

    act(() => result.current.clearQuery())
    expect(result.current.searching).toBe(false)
    expect(location()).toBe('/guia')
  })

  it('abre com a busca e o tema da URL, e mantém o ponto do fluxo nos links e na URL', () => {
    const { result } = renderHook(() => useGuideController({ guide }), {
      wrapper: providers('/guia?lat=-18.9&lon=-48.2&tema=clima', 'pt'),
    })

    expect(result.current.filters).toEqual({ theme: 'climate', query: '' })
    expect(result.current.linkQuery).toBe('?lat=-18.9&lon=-48.2')
    act(() => result.current.setTheme('soil'))
    expect(location()).toBe('/guia?lat=-18.9&lon=-48.2&tema=terra')
  })

  it('"← Voltar" sem tela anterior no app (aberto direto): segue o link para a Início', () => {
    const { result } = renderHook(() => useGuideController({ guide, canGoBack: () => false }), {
      wrapper: providers('/guia?lat=-18.9&lon=-48.2&colheita=meio'),
    })
    const event = { preventDefault: vi.fn() }

    expect(result.current.backTo).toBe('/')
    act(() => result.current.onBack(event))
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('"← Voltar" com tela anterior no app: volta para ela (a busca e o filtro não contam como tela)', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <I18nProvider initialLang="pt">
        <MemoryRouter initialEntries={['/avisos?lat=-18.9&lon=-48.2', '/guia']} initialIndex={1}>
          <Routes>
            <Route path="*" element={<>{children}<LocationProbe /></>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    )
    const { result } = renderHook(() => useGuideController({ guide, canGoBack: () => true }), { wrapper })
    const event = { preventDefault: vi.fn() }

    act(() => result.current.setTheme('soil'))
    await waitFor(() => expect(location()).toBe('/guia?tema=terra'))
    act(() => result.current.onBack(event))

    expect(event.preventDefault).toHaveBeenCalled()
    await waitFor(() => expect(location()).toBe('/avisos?lat=-18.9&lon=-48.2'))
  })

  it('usa o idioma en', () => {
    const { result } = renderHook(() => useGuideController({ guide }), { wrapper: providers('/guia', 'en') })
    expect(result.current.groups[0].articles[0].title).toBe('Sorghum')
  })

  it('"Ouvir resumo": o total de artigos (a busca não troca o resumo)', () => {
    const s = speech()
    const { result } = renderHook(() => useGuideController({ guide, speech: s }), { wrapper: providers('/guia', 'pt') })

    act(() => result.current.setQuery('vera'))
    act(() => result.current.listen.toggle())
    expect(s.speak).toHaveBeenCalledWith(
      'O Guia tem 4 artigos curtos sobre culturas, plantio, terra, clima e segurança. Busque por uma palavra, como veranico ou palhada, ou escolha um tema.',
      'pt',
      expect.any(Function),
    )
  })
})

describe('useGuideArticleController (artigo, tela 8)', () => {
  it('abre o artigo pelo slug, com as partes, o "Veja também" e o caminho de volta com o fluxo', () => {
    const field = fieldService()
    const { result } = renderHook(() => useGuideArticleController('como-evitar-erosao', { guide, field }), {
      wrapper: providers('/guia/como-evitar-erosao?lat=-18.9&lon=-48.2'),
    })

    expect(result.current.article).toBe(erosion)
    expect(result.current.layout?.sections.map((s) => s.id)).toEqual(['por-que-importa', 'na-sua-lavoura'])
    expect(result.current.related.map((a) => a.slug)).toEqual(['veranico'])
    expect(result.current.backTo).toBe('/guia?lat=-18.9&lon=-48.2')
    expect(result.current.linkQuery).toBe('?lat=-18.9&lon=-48.2')
  })

  it('"Na sua lavoura" com o ponto da URL: o lugar, a frase com o número e a fonte', async () => {
    const field = fieldService()
    const { result } = renderHook(() => useGuideArticleController('como-evitar-erosao', { guide, field }), {
      wrapper: providers('/guia/como-evitar-erosao?lat=-18.9543&lon=-48.1993'),
    })

    await waitFor(() => expect(result.current.field).not.toBeNull())
    expect(field.fact).toHaveBeenCalledWith('como-evitar-erosao', { lat: -18.9543, lon: -48.1993 }, 'pt')
    expect(result.current.field).toEqual({
      place: 'Sua lavoura, perto de Uberlândia (MG)',
      text: 'Em 20 anos, houve 5 dias com 50 mm ou mais de chuva em fevereiro e março: em média, 0,25 dia por ano.',
      source: 'Fonte: GPM IMERG (NASA), 20 anos',
    })
  })

  it('sem ponto na URL, usa o ponto salvo no aparelho', async () => {
    const field = fieldService({ lat: -18.9543, lon: -48.1993, colheita: 'cedo' })
    const { result } = renderHook(() => useGuideArticleController('como-evitar-erosao', { guide, field }), {
      wrapper: providers('/guia/como-evitar-erosao'),
    })

    await waitFor(() => expect(result.current.field).not.toBeNull())
    expect(field.fact).toHaveBeenCalledWith('como-evitar-erosao', { lat: -18.9543, lon: -48.1993, colheita: 'cedo' }, 'pt')
  })

  it('sem ponto (ou só a fazenda de exemplo), sem caixa', async () => {
    const field = fieldService(null)
    const { result } = renderHook(() => useGuideArticleController('como-evitar-erosao', { guide, field }), {
      wrapper: providers('/guia/como-evitar-erosao?lat=-18.9543&lon=-48.1993&exemplo=1'),
    })

    await waitFor(() => expect(field.fact).toHaveBeenCalled())
    expect(field.fact).toHaveBeenCalledWith('como-evitar-erosao', null, 'pt')
    expect(result.current.field).toBeNull()
  })

  it('sem o dado do ponto (ou com falha da API), sem caixa', async () => {
    const field = { savedPoint: () => null, fact: vi.fn(async () => Promise.reject(new Error('fora'))) }
    const { result } = renderHook(() => useGuideArticleController('como-evitar-erosao', { guide, field }), {
      wrapper: providers('/guia/como-evitar-erosao?lat=-18.9&lon=-48.2'),
    })

    await waitFor(() => expect(field.fact).toHaveBeenCalled())
    expect(result.current.field).toBeNull()
  })

  it('"Este artigo ajudou?" só marca a resposta (sem guardar nada)', () => {
    const field = fieldService()
    const { result } = renderHook(() => useGuideArticleController('como-evitar-erosao', { guide, field }), {
      wrapper: providers('/guia/como-evitar-erosao'),
    })

    expect(result.current.helpful).toBeNull()
    act(() => result.current.setHelpful('yes'))
    expect(result.current.helpful).toBe('yes')
    act(() => result.current.setHelpful('no'))
    expect(result.current.helpful).toBe('no')
  })

  it('"Ouvir": o título, o "Em uma frase" e o número de "Na sua lavoura"', async () => {
    const s = speech()
    const field = fieldService()
    const { result } = renderHook(() => useGuideArticleController('como-evitar-erosao', { guide, field, speech: s }), {
      wrapper: providers('/guia/como-evitar-erosao?lat=-18.9543&lon=-48.1993'),
    })

    await waitFor(() => expect(result.current.field).not.toBeNull())
    act(() => result.current.listen.toggle())
    expect(s.speak).toHaveBeenCalledWith(
      'Como evitar erosão. Erosão é a chuva levando a terra. Na sua lavoura, perto de Uberlândia (MG): Em 20 anos, houve 5 dias com 50 mm ou mais de chuva em fevereiro e março: em média, 0,25 dia por ano.',
      'pt',
      expect.any(Function),
    )
  })

  it('slug que não existe dá null', () => {
    const field = fieldService()
    const { result } = renderHook(() => useGuideArticleController('nada', { guide, field }), { wrapper: providers('/guia/nada') })
    expect(result.current.article).toBeNull()
    expect(result.current.layout).toBeNull()
  })
})
