import {
  GUIDE_PLANTS,
  GUIDE_THEMES,
  type ArticleBlock,
  type ArticleLayout,
  type ArticleSection,
  type GuideArticle,
  type GuideFilters,
  type GuidePlant,
  type GuideSummary,
  type GuideTheme,
  type GuideThemeFilter,
  type HighlightPart,
} from '../models/guide'
import { guideRepository, type GuideRepository } from '../repositories/guideRepository'
import type { Lang } from '../i18n/language'
import { parseMarkdown, plainText, type Block, type Inline } from './markdownService'

/** Nomes do tema no cabeçalho do arquivo e na URL (em português) → tema do código. */
const THEME_BY_HEADER: Record<string, GuideTheme> = {
  culturas: 'cultures',
  plantar: 'planting',
  terra: 'soil',
  clima: 'climate',
  seguranca: 'safety',
}
const HEADER_BY_THEME = Object.fromEntries(Object.entries(THEME_BY_HEADER).map(([k, v]) => [v, k])) as Record<GuideTheme, string>

/** Palavras por minuto do tempo de leitura (tela 8: "cerca de 200 palavras por minuto, mínimo 1"). */
export const WORDS_PER_MINUTE = 200
/** "Veja também": até 3 artigos. */
const MAX_RELATED = 3
const SLUG = /^[a-z0-9-]+$/

/**
 * Cabeçalho simples, "chave: valor" entre duas linhas `---` no começo do arquivo.
 * Devolve null se o arquivo não começa com ele.
 */
export function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw)
  if (!match) return null
  const meta: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return { meta, body: match[2] }
}

/** Sem acento e em minúsculas, letra por letra (o tamanho de cada letra pode mudar: "é" → "e"). */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

const normalize = (text: string) => fold(text).trim()

/** Minutos de leitura pelo texto: ~200 palavras por minuto, arredondando para cima, mínimo 1. */
export function readingMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

/** Busca no título e no resumo, sem acento e sem diferença de maiúscula. Busca vazia devolve tudo. */
export function searchGuides<T extends { title: string; summary: string }>(list: readonly T[], query: string): T[] {
  const q = normalize(query)
  return q ? list.filter((item) => normalize(`${item.title} ${item.summary}`).includes(q)) : [...list]
}

/**
 * Os trechos do texto que batem com a busca (sem acento e sem maiúscula), para a view pôr num `<mark>`.
 * A comparação é no texto dobrado, mas os pedaços devolvidos são do texto original.
 */
export function highlight(text: string, query: string): HighlightPart[] {
  const q = normalize(query)
  if (!q) return [{ text, mark: false }]
  // Para cada letra do texto dobrado, de que letra do original ela veio.
  let folded = ''
  const origin: number[] = []
  for (let i = 0; i < text.length; i++) {
    const piece = fold(text[i])
    folded += piece
    for (let k = 0; k < piece.length; k++) origin.push(i)
  }
  const parts: HighlightPart[] = []
  let cursor = 0
  let from = folded.indexOf(q)
  while (from >= 0) {
    const start = origin[from]
    const end = origin[from + q.length - 1] + 1
    if (start > cursor) parts.push({ text: text.slice(cursor, start), mark: false })
    parts.push({ text: text.slice(start, end), mark: true })
    cursor = end
    from = folded.indexOf(q, from + q.length)
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), mark: false })
  return parts.length > 0 ? parts : [{ text, mark: false }]
}

/** A contagem de cada pílula do filtro: "Todos" e os 5 temas, na ordem. */
export function themeCounts(list: readonly GuideSummary[]): { key: GuideThemeFilter; count: number }[] {
  return [
    { key: 'all', count: list.length },
    ...GUIDE_THEMES.map((theme) => ({ key: theme, count: list.filter((a) => a.theme === theme).length })),
  ]
}

export function filterByTheme<T extends { theme: GuideTheme }>(list: readonly T[], theme: GuideThemeFilter): T[] {
  return theme === 'all' ? [...list] : list.filter((a) => a.theme === theme)
}

/** O filtro (`tema`, em português) e a busca (`q`) da URL da página inicial. */
export function readGuideFilters(search: URLSearchParams): GuideFilters {
  return { theme: THEME_BY_HEADER[search.get('tema') ?? ''] ?? 'all', query: search.get('q') ?? '' }
}

/** O endereço da página inicial com o fluxo da URL (`?lat=…`, ou ""), a busca e o tema. */
export function guideIndexUrl(flowQuery: string, filters: GuideFilters): string {
  const extra = [
    filters.query ? `q=${encodeURIComponent(filters.query)}` : '',
    filters.theme !== 'all' ? `tema=${HEADER_BY_THEME[filters.theme]}` : '',
  ].filter(Boolean)
  if (extra.length === 0) return `/guia${flowQuery}`
  return `/guia${flowQuery ? `${flowQuery}&` : '?'}${extra.join('&')}`
}

/** "Comece por aqui" (tela 8, só em "Todos"): os 3 artigos de destaque, nesta ordem. */
export const FEATURED_SLUGS = ['raio-x', 'deu-certo', 'prazo-de-plantio-zarc'] as const

export function featuredArticles<T extends { slug: string }>(list: readonly T[]): T[] {
  return FEATURED_SLUGS.flatMap((slug) => list.find((a) => a.slug === slug) ?? [])
}

/** "Veja também": os relacionados do cabeçalho que existem; sem eles, até 3 outros do mesmo tema. */
export function relatedArticles(article: GuideSummary, list: readonly GuideSummary[]): GuideSummary[] {
  const bySlug = new Map(list.map((a) => [a.slug, a]))
  const chosen = article.related.flatMap((slug) => bySlug.get(slug) ?? [])
  const pool = chosen.length > 0 ? chosen : list.filter((a) => a.theme === article.theme && a.slug !== article.slug)
  return pool.slice(0, MAX_RELATED)
}

/** Âncora de uma seção ("Conheça a planta" → "conheca-a-planta"). */
export function sectionId(title: string): string {
  return normalize(title)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Títulos fixos das seções (guia de conteúdo do Guia), nos dois idiomas. */
const SENTENCE_TITLES = ['em uma frase', 'in one sentence']
const FIELD_TITLES = ['na sua lavoura', 'in your field']
const SOURCES_TITLES = ['fontes', 'sources']

const inlineText = (items: readonly Inline[]) => items.map((i) => i.text).join('')

/** Lista curta (2 a 4 itens) em que todo item começa com "**Nome:**": vira cartões ("Os três cuidados"). */
function asCards(block: Block): ArticleBlock {
  if (block.type !== 'list' || block.items.length < 2 || block.items.length > 4) return block
  const items = block.items.map((item) => {
    const [first, ...rest] = item
    if (first?.type !== 'strong' || !first.text.trim().endsWith(':')) return null
    // No cartão, o texto começa a frase: "a palhada protege…" vira "A palhada protege…".
    const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
    const text = rest.map((inline, i) =>
      i === 0 && inline.type === 'text' ? { ...inline, text: capitalize(inline.text.trimStart()) } : inline,
    )
    return { title: first.text.trim().slice(0, -1), text }
  })
  return items.every((item) => item !== null) ? { type: 'cards', items } : block
}

/** As partes do artigo: o "Em uma frase" em destaque, as seções (com âncora) e as fontes, recolhíveis. */
export function articleLayout(blocks: readonly Block[]): ArticleLayout {
  let sentence: Inline[] | null = null
  const sections: ArticleSection[] = []
  const sources: Block[] = []
  let current: 'sentence' | 'sources' | ArticleSection | null = null
  for (const block of blocks) {
    if (block.type === 'heading' && block.level === 2) {
      const title = inlineText(block.children)
      const key = normalize(title)
      if (SENTENCE_TITLES.includes(key)) current = 'sentence'
      else if (SOURCES_TITLES.includes(key)) current = 'sources'
      else {
        current = { id: sectionId(title), title, field: FIELD_TITLES.includes(key), blocks: [] }
        sections.push(current)
      }
      continue
    }
    if (current === 'sentence') {
      if (block.type === 'paragraph' && sentence === null) sentence = block.children
    } else if (current === 'sources') sources.push(block)
    else if (current) current.blocks.push(asCards(block))
  }
  return { sentence, sections, sources }
}

export type GuideGroup = { theme: GuideTheme; articles: GuideSummary[] }

const YES = ['sim', 'yes', 'true']

export function createGuideService(repository: GuideRepository = guideRepository) {
  function parse(file: { slug: string; raw: string }): GuideArticle | null {
    const front = parseFrontMatter(file.raw)
    if (!front) return null
    const theme = THEME_BY_HEADER[front.meta.tema ?? '']
    if (!theme || !front.meta.titulo) return null
    const plant = GUIDE_PLANTS.includes(front.meta.planta as GuidePlant) ? (front.meta.planta as GuidePlant) : null
    const blocks = parseMarkdown(front.body)
    const related = (front.meta.relacionados ?? '')
      .split(',')
      .map((slug) => slug.trim())
      .filter((slug, i, all) => SLUG.test(slug) && slug !== file.slug && all.indexOf(slug) === i)
      .slice(0, MAX_RELATED)
    return {
      slug: file.slug,
      title: front.meta.titulo,
      theme,
      summary: front.meta.resumo ?? '',
      draft: YES.includes((front.meta.rascunho ?? '').toLowerCase()),
      plant,
      // Calculado pelo texto, nunca escrito à mão (um `min` no cabeçalho é ignorado).
      minutes: readingMinutes(plainText(blocks)),
      related,
      blocks,
    }
  }

  function all(lang: Lang): GuideArticle[] {
    return repository
      .files()
      .filter((file) => file.lang === lang)
      .flatMap((file) => parse(file) ?? [])
  }

  return {
    list: (lang: Lang): GuideSummary[] => all(lang).map(({ blocks: _blocks, ...summary }) => summary),
    get: (lang: Lang, slug: string): GuideArticle | null => all(lang).find((a) => a.slug === slug) ?? null,
    groups: (list: readonly GuideSummary[]): GuideGroup[] =>
      GUIDE_THEMES.map((theme) => ({ theme, articles: list.filter((a) => a.theme === theme) })).filter(
        (group) => group.articles.length > 0,
      ),
  }
}

export type GuideService = ReturnType<typeof createGuideService>
export const guideService = createGuideService()

/**
 * O "Ouvir resumo" de um artigo (regra geral 9 do pacote 2): o título e o primeiro parágrafo depois do primeiro
 * título de seção (o "Em uma frase" / "In one sentence"). Sem esse parágrafo, só o título.
 */
export function articleSummary(article: Pick<GuideArticle, 'title' | 'blocks'>): string {
  const first = article.blocks.findIndex((block) => block.type === 'heading')
  const sentence = article.blocks.slice(first + 1).find((block) => block.type === 'paragraph')
  const text = sentence ? plainText([sentence]).trim() : ''
  return text ? `${article.title}. ${text}` : article.title
}
