import type { Lang } from '../i18n/language'
import type {
  AguaTerra,
  AlertaChuvaForte,
  AlertaFogo,
  AlertaGeada,
  CalorOutono,
  ChuvaTipica,
  ClimaFuturo,
  FaixaNdvi,
  RaioX,
  RaioXParams,
  RegiaoChuva,
  SoloRaioX,
  UmidadeAgora,
  Veranico,
  VerdeLavoura,
} from '../models/raioX'
import type { Historico, SituacaoAno } from '../models/talhao'
import { raioXRepository as defaultRepository } from '../repositories'
import type { RaioXRepository } from '../repositories/raioXRepository'

export type RaioXService = {
  get(params: RaioXParams, lang: Lang): Promise<RaioX>
}

/** Raio-X da sua terra (tela 4, tarefa 0043): as contas ficam no backend (`/api/raio-x`). */
export function createRaioXService(repository: RaioXRepository = defaultRepository): RaioXService {
  return { get: (params, lang) => repository.get(params, lang) }
}

export const raioXService = createRaioXService()

/** Um bloco do painel, na ordem do pedido (seção 4): o número vem pronto do backend. */
export type XRayBlock =
  | { kind: 'soil'; data: SoloRaioX }
  | { kind: 'water'; data: AguaTerra }
  | { kind: 'moisture'; data: UmidadeAgora }
  | { kind: 'green'; data: VerdeLavoura }
  | { kind: 'rain'; data: ChuvaTipica }
  | { kind: 'dryspell'; data: Veranico }
  | { kind: 'heat'; data: CalorOutono }
  | { kind: 'region'; data: RegiaoChuva }

/** Os blocos com dado, na ordem do painel; o bloco sem dado não aparece (regra geral do pedido). */
export function xRayBlocks(raio: RaioX | undefined): XRayBlock[] {
  if (!raio) return []
  const blocks: (XRayBlock | null)[] = [
    raio.solo && { kind: 'soil', data: raio.solo },
    raio.agua && { kind: 'water', data: raio.agua },
    raio.umidade && { kind: 'moisture', data: raio.umidade },
    raio.verde && { kind: 'green', data: raio.verde },
    raio.chuva && { kind: 'rain', data: raio.chuva },
    raio.veranico && { kind: 'dryspell', data: raio.veranico },
    raio.calor && { kind: 'heat', data: raio.calor },
    raio.regiao && { kind: 'region', data: raio.regiao },
  ]
  return blocks.filter((block): block is XRayBlock => block !== null)
}

/** Barra dividida do solo em % inteiros: argila, silte (o que sobra) e areia. */
export function soilParts(solo: SoloRaioX): { clay: number; silt: number; sand: number } {
  const clay = Math.round(solo.argila_pct)
  const sand = Math.round(solo.areia_pct)
  return { clay, silt: Math.max(0, 100 - clay - sand), sand }
}

/**
 * Faixas de cor do NDVI (1 a 5; 0 = sem leitura boa). Os cortes 0,45 e 0,60 são os do histórico do
 * talhão (`historico_ndvi` do backend: abaixo de 0,45 parado, acima de 0,60 plantou).
 */
export const NDVI_BREAKS = [0.3, 0.45, 0.6, 0.75] as const

export type NdviLevel = 0 | 1 | 2 | 3 | 4 | 5

export function ndviLevel(value: number | null): NdviLevel {
  if (value === null) return 0
  return (NDVI_BREAKS.filter((limit) => value >= limit).length + 1) as NdviLevel
}

export type HeatmapRow = {
  year: number
  cells: { value: number | null; level: NdviLevel }[]
  /** O que aconteceu na entressafra (com a resposta do produtor no lugar do satélite). */
  situation: SituacaoAno | null
  byProducer: boolean
}

/** Faixas de colunas `[de, até)` marcadas no topo; `harvest` é a coluna da colheita. */
export type HeatmapMarks = { soy: [number, number]; harvest: number | null; offseason: [number, number] }

export type Heatmap = {
  columns: string[]
  rows: HeatmapRow[]
  marks: HeatmapMarks
  /** Primeira coluna de cada mês (1 = janeiro), para o eixo de cima. */
  months: { month: number; from: number }[]
  source: string
}

const OFFSEASON_FALLBACK = '04-01'

function columnOf(columns: string[], day: string): number {
  const index = columns.findLastIndex((start) => start <= day)
  return Math.max(0, index)
}

/**
 * Histórico do talhão em faixa de calor: as linhas do backend (`historico_ndvi` do `/raio-x`), com o
 * que aconteceu em cada ano vindo do histórico do talhão já com as safras confirmadas. A colheita é o
 * dia em que a soja costuma secar (RF-16); sem ele, a entressafra começa em abril (janela do histórico).
 */
export function heatmap(strip: FaixaNdvi | null | undefined, historico: Historico | null): Heatmap | null {
  if (!strip) return null
  const byYear = new Map((historico?.anos ?? []).map((ano) => [ano.ano, ano]))
  const columns = strip.colunas
  const harvest = strip.colheita_dia ? columnOf(columns, strip.colheita_dia) : null
  const offseasonStart = harvest !== null ? harvest + 1 : columns.findIndex((start) => start >= OFFSEASON_FALLBACK)
  const start = offseasonStart < 0 ? columns.length : offseasonStart
  const months: Heatmap['months'] = []
  columns.forEach((column, index) => {
    const month = Number(column.slice(0, 2))
    if (months.at(-1)?.month !== month) months.push({ month, from: index })
  })
  return {
    columns,
    rows: strip.anos.map((row) => ({
      year: row.ano,
      cells: row.valores.map((value) => ({ value, level: ndviLevel(value) })),
      situation: byYear.get(row.ano)?.situacao ?? null,
      byProducer: byYear.get(row.ano)?.fonte_ano === 'produtor',
    })),
    marks: { soy: [0, harvest ?? start], harvest, offseason: [start, columns.length] },
    months,
    source: strip.fonte,
  }
}

export type AreaAlert =
  | { kind: 'frost'; data: AlertaGeada }
  | { kind: 'heavyRain'; data: AlertaChuvaForte }
  | { kind: 'fire'; data: AlertaFogo }

/** Os alertas que o backend mandou (cada um só vem com risco), na ordem geada, chuva forte e fogo. */
export function alertList(raio: RaioX | undefined): AreaAlert[] {
  if (!raio) return []
  const { geada, chuva_forte: chuvaForte, fogo } = raio.alertas
  const alerts: (AreaAlert | null)[] = [
    geada && { kind: 'frost', data: geada },
    chuvaForte && { kind: 'heavyRain', data: chuvaForte },
    fogo && { kind: 'fire', data: fogo },
  ]
  return alerts.filter((alert): alert is AreaAlert => alert !== null)
}

/** "Mais seca que X% da região" ou, se a maioria chove menos, "mais chuvosa que Y% da região". */
export function regionSide(regiao: RegiaoChuva): { side: 'drier' | 'wetter'; pct: number } {
  return regiao.pct_mais_seca >= regiao.pct_mais_chuvosa
    ? { side: 'drier', pct: regiao.pct_mais_seca }
    : { side: 'wetter', pct: regiao.pct_mais_chuvosa }
}

/** "3 de 3 modelos indicam menos chuva" / "2 de 3 indicam mais chuva" e quantos indicam mais calor. */
export function futureAgreement(clima: ClimaFuturo): {
  rain: { direction: 'less' | 'more' | 'split'; count: number }
  heat: number
  models: number
} {
  const less = clima.modelos_menos_chuva
  const more = clima.modelos_mais_chuva
  const rain =
    less > more
      ? { direction: 'less' as const, count: less }
      : more > less
        ? { direction: 'more' as const, count: more }
        : { direction: 'split' as const, count: less }
  return { rain, heat: clima.modelos_mais_quente, models: clima.modelos }
}
