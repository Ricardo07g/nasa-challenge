import type { Block } from '../services/markdownService'

/** Os 5 temas do Guia, na ordem em que aparecem na página inicial. */
export const GUIDE_THEMES = ['cultures', 'planting', 'soil', 'climate', 'safety'] as const
export type GuideTheme = (typeof GUIDE_THEMES)[number]

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
  /** Rascunho a revisar pela agrônoma (cultura, plantio e manejo). */
  draft: boolean
  plant: GuidePlant | null
}

export type GuideArticle = GuideSummary & { blocks: Block[] }

/** Arquivo Markdown bruto, como está no repositório. */
export type GuideFile = { lang: 'pt' | 'en'; slug: string; raw: string }
