import { describe, expect, it, vi } from 'vitest'
import type { GuideFile, GuideSummary } from '../models/guide'
import { parseMarkdown } from './markdownService'
import {
  articleLayout,
  articleSummary,
  createGuideService,
  FEATURED_SLUGS,
  featuredArticles,
  filterByTheme,
  guideIndexUrl,
  highlight,
  parseFrontMatter,
  readGuideFilters,
  readingMinutes,
  relatedArticles,
  searchGuides,
  sectionId,
  themeCounts,
} from './guideService'

const header = (o: Record<string, string>) =>
  `---\n${Object.entries(o)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}\n---\n`

const words = (n: number) => Array.from({ length: n }, () => 'palavra').join(' ')

const files: GuideFile[] = [
  {
    lang: 'pt',
    slug: 'sorgo',
    raw:
      header({
        titulo: 'Sorgo',
        resumo: 'Dá grão e aguenta mais seca que o milho.',
        tema: 'culturas',
        slug: 'sorgo',
        rascunho: 'sim',
        planta: 'sorgo',
        relacionados: 'veranico, nao-existe, sorgo',
      }) + `## Em uma frase\n\n${words(250)}`,
  },
  {
    lang: 'pt',
    slug: 'veranico',
    raw: header({ titulo: 'Veranico', resumo: 'Dias seguidos sem chuva.', tema: 'clima', slug: 'veranico', rascunho: 'nao' }) + 'Texto.',
  },
  {
    lang: 'pt',
    slug: 'ouvir',
    raw: header({ titulo: 'Álgebra do Ônibus', resumo: 'Proteção contra erosão.', tema: 'seguranca', slug: 'ouvir', rascunho: 'nao' }) + 'x',
  },
  {
    lang: 'en',
    slug: 'sorgo',
    raw: header({ titulo: 'Sorghum', resumo: 'Grain.', tema: 'culturas', slug: 'sorgo', rascunho: 'yes' }) + 'Text.',
  },
]
const repo = { files: vi.fn(() => files) }

describe('parseFrontMatter', () => {
  it('separa o cabeçalho do corpo', () => {
    const { meta, body } = parseFrontMatter('---\ntitulo: A: b\ntema: clima\n---\n\nCorpo')!
    expect(meta).toEqual({ titulo: 'A: b', tema: 'clima' })
    expect(body.trim()).toBe('Corpo')
  })

  it('sem cabeçalho devolve null', () => {
    expect(parseFrontMatter('só texto')).toBeNull()
  })
})

describe('readingMinutes (tempo de leitura calculado pelo texto, tela 8)', () => {
  it('cerca de 200 palavras por minuto, arredondando para cima', () => {
    expect(readingMinutes(words(200))).toBe(1)
    expect(readingMinutes(words(201))).toBe(2)
    expect(readingMinutes(words(450))).toBe(3)
  })

  it('mínimo de 1 minuto, mesmo sem texto', () => {
    expect(readingMinutes('')).toBe(1)
    expect(readingMinutes('  uma  ')).toBe(1)
  })
})

describe('guideService', () => {
  const service = createGuideService(repo)

  it('lista os artigos do idioma, com tema, resumo, rascunho, planta e tempo de leitura', () => {
    expect(service.list('pt').map((a) => a.slug)).toEqual(['sorgo', 'veranico', 'ouvir'])
    expect(service.list('pt')[0]).toMatchObject({
      theme: 'cultures',
      title: 'Sorgo',
      summary: 'Dá grão e aguenta mais seca que o milho.',
      draft: true,
      plant: 'sorgo',
      minutes: 2,
    })
    expect(service.list('pt')[1]).toMatchObject({ draft: false, minutes: 1 })
    expect(service.list('en')).toHaveLength(1)
    expect(service.list('en')[0].draft).toBe(true)
  })

  it('o tempo de leitura vem do texto do artigo, não de um número escrito à mão', () => {
    const withMin = createGuideService({
      files: () => [{ lang: 'pt', slug: 'a', raw: header({ titulo: 'A', tema: 'clima', slug: 'a', rascunho: 'nao', min: '9' }) + words(390) }],
    })
    expect(withMin.list('pt')[0].minutes).toBe(2)
  })

  it('relacionados: só slugs bem formados, sem repetir o próprio artigo, até 3', () => {
    expect(service.list('pt')[0].related).toEqual(['veranico', 'nao-existe'])
    expect(service.list('pt')[1].related).toEqual([])
  })

  it('agrupa pelos 5 temas, na ordem fixa, e some com o tema vazio', () => {
    const groups = service.groups(service.list('pt'))
    expect(groups.map((g) => g.theme)).toEqual(['cultures', 'climate', 'safety'])
  })

  it('abre um artigo com os blocos; inexistente dá null', () => {
    expect(service.get('pt', 'sorgo')?.blocks[0]).toMatchObject({ type: 'heading' })
    expect(service.get('pt', 'nao-existe')).toBeNull()
  })

  it('ignora arquivo com tema inválido ou sem cabeçalho', () => {
    const bad = createGuideService({
      files: () => [
        { lang: 'pt', slug: 'a', raw: header({ titulo: 'A', tema: 'xxx', slug: 'a', rascunho: 'nao' }) },
        { lang: 'pt', slug: 'b', raw: 'sem cabeçalho' },
      ],
    })
    expect(bad.list('pt')).toEqual([])
  })
})

const summary = (slug: string, theme: GuideSummary['theme'], related: string[] = []): GuideSummary => ({
  slug,
  title: slug,
  summary: '',
  theme,
  draft: false,
  plant: null,
  minutes: 1,
  related,
})

describe('relatedArticles ("Veja também")', () => {
  const list = [
    summary('erosao', 'soil', ['palhada', 'some', 'veranico']),
    summary('palhada', 'soil'),
    summary('rotacao', 'soil'),
    summary('adubo', 'soil'),
    summary('nematoide', 'soil'),
    summary('veranico', 'climate'),
  ]

  it('os relacionados do cabeçalho, na ordem, só os que existem', () => {
    expect(relatedArticles(list[0], list).map((a) => a.slug)).toEqual(['palhada', 'veranico'])
  })

  it('sem relacionados, até 3 outros do mesmo tema', () => {
    expect(relatedArticles(list[1], list).map((a) => a.slug)).toEqual(['erosao', 'rotacao', 'adubo'])
    expect(relatedArticles(list[5], list)).toEqual([])
  })
})

describe('featuredArticles ("Comece por aqui")', () => {
  it('os 3 destaques da tela 8, na ordem: raio-X, "deu certo" e o prazo de plantio', () => {
    expect(FEATURED_SLUGS).toEqual(['raio-x', 'deu-certo', 'prazo-de-plantio-zarc'])
    const list = [summary('deu-certo', 'climate'), summary('sorgo', 'cultures'), summary('raio-x', 'climate')]
    expect(featuredArticles(list).map((a) => a.slug)).toEqual(['raio-x', 'deu-certo'])
  })
})

describe('searchGuides (busca da tela 8)', () => {
  const list = createGuideService(repo).list('pt')

  it('busca no título, sem acento e sem maiúscula', () => {
    expect(searchGuides(list, 'ONIBUS').map((a) => a.slug)).toEqual(['ouvir'])
    expect(searchGuides(list, 'vera').map((a) => a.slug)).toEqual(['veranico'])
  })

  it('busca também no resumo ("erosao" acha "erosão")', () => {
    expect(searchGuides(list, 'erosao').map((a) => a.slug)).toEqual(['ouvir'])
    expect(searchGuides(list, 'SECA').map((a) => a.slug)).toEqual(['sorgo'])
  })

  it('busca vazia devolve tudo; sem resultado, lista vazia', () => {
    expect(searchGuides(list, '  ')).toHaveLength(3)
    expect(searchGuides(list, 'zzz')).toEqual([])
  })
})

describe('highlight (a palavra marcada com <mark>)', () => {
  it('marca o trecho sem diferenciar acento nem maiúscula, mantendo o texto original', () => {
    expect(highlight('Como evitar erosão', 'EROSAO')).toEqual([
      { text: 'Como evitar ', mark: false },
      { text: 'erosão', mark: true },
    ])
  })

  it('acento antes do trecho não desloca a marca', () => {
    expect(highlight('Água da chuva', 'chuva')).toEqual([
      { text: 'Água da ', mark: false },
      { text: 'chuva', mark: true },
    ])
  })

  it('marca todas as vezes que aparece', () => {
    expect(highlight('chuva e mais chuva', 'chuva').filter((p) => p.mark)).toHaveLength(2)
  })

  it('sem busca ou sem achar, o texto inteiro sem marca', () => {
    expect(highlight('Sorgo', '')).toEqual([{ text: 'Sorgo', mark: false }])
    expect(highlight('Sorgo', 'milho')).toEqual([{ text: 'Sorgo', mark: false }])
  })
})

describe('filtros por tema', () => {
  const list = [summary('a', 'cultures'), summary('b', 'cultures'), summary('c', 'climate')]

  it('a contagem de cada pílula: "Todos" e os 5 temas, na ordem', () => {
    expect(themeCounts(list)).toEqual([
      { key: 'all', count: 3 },
      { key: 'cultures', count: 2 },
      { key: 'planting', count: 0 },
      { key: 'soil', count: 0 },
      { key: 'climate', count: 1 },
      { key: 'safety', count: 0 },
    ])
  })

  it('o filtro mostra só os artigos do tema; "Todos" mostra tudo', () => {
    expect(filterByTheme(list, 'cultures').map((a) => a.slug)).toEqual(['a', 'b'])
    expect(filterByTheme(list, 'all')).toHaveLength(3)
  })

  it('lê o filtro e a busca da URL (tema em português, como no cabeçalho dos artigos)', () => {
    expect(readGuideFilters(new URLSearchParams('tema=clima&q=chuva'))).toEqual({ theme: 'climate', query: 'chuva' })
    expect(readGuideFilters(new URLSearchParams('tema=xxx'))).toEqual({ theme: 'all', query: '' })
  })

  it('monta o endereço do Guia com o fluxo, a busca e o tema', () => {
    expect(guideIndexUrl('', { theme: 'all', query: '' })).toBe('/guia')
    expect(guideIndexUrl('', { theme: 'soil', query: '' })).toBe('/guia?tema=terra')
    expect(guideIndexUrl('?lat=-18.9&lon=-48.2', { theme: 'all', query: 'água boa' })).toBe(
      '/guia?lat=-18.9&lon=-48.2&q=%C3%A1gua%20boa',
    )
  })
})

describe('articleLayout (as partes do artigo na tela)', () => {
  const blocks = parseMarkdown(
    [
      '## Em uma frase',
      '',
      'O **sorgo** aguenta seca.',
      '',
      '## Por que importa',
      '',
      'Três cuidados:',
      '',
      '- **Cobertura:** a palha protege.',
      '- **Plantio direto:** sem arar.',
      '',
      '- sem negrito',
      '- outro',
      '',
      '## Na sua lavoura',
      '',
      'Veja a tela.',
      '',
      '## Fontes',
      '',
      '- [Embrapa](https://www.embrapa.br)',
    ].join('\n'),
  )

  it('separa o "Em uma frase", as seções com âncora e as fontes', () => {
    const layout = articleLayout(blocks)
    expect(layout.sentence?.map((i) => i.text).join('')).toBe('O sorgo aguenta seca.')
    expect(layout.sections.map((s) => [s.id, s.title, s.field])).toEqual([
      ['por-que-importa', 'Por que importa', false],
      ['na-sua-lavoura', 'Na sua lavoura', true],
    ])
    expect(layout.sources).toHaveLength(1)
  })

  it('lista de 2 a 4 itens com "**Nome:** texto" vira cartões (texto com maiúscula); as outras listas continuam listas', () => {
    const [why] = articleLayout(blocks).sections
    expect(why.blocks.map((b) => b.type)).toEqual(['paragraph', 'cards', 'list'])
    expect(why.blocks[1]).toMatchObject({
      type: 'cards',
      items: [
        { title: 'Cobertura', text: [{ type: 'text', text: 'A palha protege.' }] },
        { title: 'Plantio direto', text: [{ type: 'text', text: 'Sem arar.' }] },
      ],
    })
  })

  it('em inglês, as mesmas partes pelos títulos fixos', () => {
    const layout = articleLayout(
      parseMarkdown('## In one sentence\n\nText.\n\n## In your field\n\nSee.\n\n## Sources\n\n- x'),
    )
    expect(layout.sentence).not.toBeNull()
    expect(layout.sections.map((s) => [s.id, s.field])).toEqual([['in-your-field', true]])
    expect(layout.sources).toHaveLength(1)
  })

  it('a âncora da seção não tem acento nem espaço', () => {
    expect(sectionId('Conheça a planta')).toBe('conheca-a-planta')
    expect(sectionId('Step by step')).toBe('step-by-step')
  })
})

describe('articleSummary ("Ouvir resumo" do artigo, pacote 2)', () => {
  const base = summary('sorgo', 'cultures')

  it('o título e a frase do "Em uma frase" (o 1º parágrafo depois do 1º título), sem o negrito', () => {
    const blocks = parseMarkdown('## Em uma frase\n\nO **sorgo** aguenta mais a seca.\n\n## Por que importa\n\nOutro parágrafo.')
    expect(articleSummary({ ...base, title: 'Sorgo', blocks })).toBe('Sorgo. O sorgo aguenta mais a seca.')
  })

  it('sem parágrafo, só o título', () => {
    expect(articleSummary({ ...base, title: 'Sorgo', blocks: [] })).toBe('Sorgo')
  })
})
