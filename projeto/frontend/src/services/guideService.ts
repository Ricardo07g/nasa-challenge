import {
  GUIDE_PLANTS,
  GUIDE_THEMES,
  type GuideArticle,
  type GuidePlant,
  type GuideSummary,
  type GuideTheme,
} from '../models/guide'
import { guideRepository, type GuideRepository } from '../repositories/guideRepository'
import type { Lang } from '../i18n/language'
import { parseMarkdown, plainText } from './markdownService'

/** Nomes do tema no cabeçalho do arquivo (em português) → tema do código. */
const THEME_BY_HEADER: Record<string, GuideTheme> = {
  culturas: 'cultures',
  plantar: 'planting',
  terra: 'soil',
  clima: 'climate',
  seguranca: 'safety',
}

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

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()

/** Busca simples por título (sem acento e sem diferença de maiúscula). Busca vazia devolve tudo. */
export function searchGuides<T extends { title: string }>(list: readonly T[], query: string): T[] {
  const q = normalize(query)
  return q ? list.filter((item) => normalize(item.title).includes(q)) : [...list]
}

export type GuideGroup = { theme: GuideTheme; articles: GuideSummary[] }

export function createGuideService(repository: GuideRepository = guideRepository) {
  function parse(file: { slug: string; raw: string }): GuideArticle | null {
    const front = parseFrontMatter(file.raw)
    if (!front) return null
    const theme = THEME_BY_HEADER[front.meta.tema ?? '']
    if (!theme || !front.meta.titulo) return null
    const plant = GUIDE_PLANTS.includes(front.meta.planta as GuidePlant) ? (front.meta.planta as GuidePlant) : null
    return {
      slug: file.slug,
      title: front.meta.titulo,
      theme,
      draft: ['sim', 'yes', 'true'].includes((front.meta.rascunho ?? '').toLowerCase()),
      plant,
      blocks: parseMarkdown(front.body),
    }
  }

  function all(lang: Lang): GuideArticle[] {
    return repository
      .files()
      .filter((file) => file.lang === lang)
      .flatMap((file) => parse(file) ?? [])
  }

  return {
    list: (lang: Lang): GuideSummary[] =>
      all(lang).map(({ slug, title, theme, draft, plant }) => ({ slug, title, theme, draft, plant })),
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
export function articleSummary(article: GuideArticle): string {
  const first = article.blocks.findIndex((block) => block.type === 'heading')
  const sentence = article.blocks.slice(first + 1).find((block) => block.type === 'paragraph')
  const text = sentence ? plainText([sentence]).trim() : ''
  return text ? `${article.title}. ${text}` : article.title
}
