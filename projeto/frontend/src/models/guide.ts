import type { Block, Inline } from '../services/markdownService'

/** Os 5 temas do Guia, na ordem em que aparecem na página inicial. */
export const GUIDE_THEMES = ['cultures', 'planting', 'soil', 'climate', 'safety'] as const
export type GuideTheme = (typeof GUIDE_THEMES)[number]

/** O filtro da página inicial (tela 8): "Todos" ou um tema. */
export type GuideThemeFilter = 'all' | GuideTheme

/** Busca e filtro da página inicial, também na URL (`q` e `tema`). */
export type GuideFilters = { theme: GuideThemeFilter; query: string }

/** Cultura com ilustração própria (mesmos ids do culturas.yaml). */
export const GUIDE_PLANTS = [
  'milho_safrinha',
  'milho_braquiaria',
  'sorgo',
  'milheto',
  'crotalaria',
  'pousio',
] as const
export type GuidePlant = (typeof GUIDE_PLANTS)[number]

export type GuideSummary = {
  slug: string
  title: string
  theme: GuideTheme
  /** Uma linha para o cartão (cabeçalho `resumo`). */
  summary: string
  /** Cabeçalho `rascunho` do arquivo. Desde 15/11/2026 nenhuma tela mostra (regra do usuário: sem "em revisão"). */
  draft: boolean
  plant: GuidePlant | null
  /** Minutos de leitura, calculados pelo texto (~200 palavras por minuto, mínimo 1). */
  minutes: number
  /** Até 3 slugs do cabeçalho `relacionados`; sem eles, o "Veja também" usa outros do mesmo tema. */
  related: string[]
}

export type GuideArticle = GuideSummary & { blocks: Block[] }

/** Arquivo Markdown bruto, como está no repositório. */
export type GuideFile = { lang: 'pt' | 'en'; slug: string; raw: string }

/** Um pedaço de texto da busca: `mark` = o trecho que bate com a busca (vai num `<mark>`). */
export type HighlightPart = { text: string; mark: boolean }

/** Bloco do corpo do artigo na tela: os do Markdown e a lista curta de cuidados que vira cartões. */
export type ArticleBlock = Block | { type: 'cards'; items: { title: string; text: Inline[] }[] }

/** Uma seção do artigo, com a âncora do índice "Neste artigo". `field` = "Na sua lavoura". */
export type ArticleSection = { id: string; title: string; field: boolean; blocks: ArticleBlock[] }

/** As partes do artigo na tela 8: o "Em uma frase" em destaque, as seções e as fontes (recolhíveis). */
export type ArticleLayout = { sentence: Inline[] | null; sections: ArticleSection[]; sources: Block[] }
