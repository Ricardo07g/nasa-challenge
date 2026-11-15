import type { FaixaNdvi } from '../models/raioX'
import type { CropId } from '../models/recomendacao'
import type { CurrentChoice, SeasonAnswers } from '../models/seasonAnswers'
import type { Historico, SituacaoAno } from '../models/talhao'
import { ndviLevel, type NdviLevel } from './raioXService'
import { CURRENT_SEASON, LAST_SEASONS } from './seasonService'

/**
 * Gráfico "Suas últimas safras" da tela 4 (pacote 2, tarefa 0058): o verde que o satélite leu em cada safra,
 * de janeiro a julho do ano da colheita (uma linha por safra), e, à direita, a resposta do produtor ou o que o
 * satélite viu depois da soja. Dentro das barras só entra o que o satélite leu (regra geral 5): nenhum rótulo.
 */

/** O começo de cada leitura de 16 dias do MODIS, de janeiro a julho: as colunas quando a API não manda as dela. */
export const DEFAULT_COLUMNS = ['01-01', '01-17', '02-02', '02-18', '03-06', '03-22', '04-07', '04-23', '05-09', '05-25', '06-10', '06-26', '07-12', '07-28']

/** Sem o dia da colheita, o "depois da soja" começa em abril (a janela do histórico do talhão). */
const OFFSEASON_FALLBACK = '04-01'

/** O que vai na coluna da direita de uma safra passada. */
export type SeasonChartStatus =
  /** A resposta do produtor: a cultura do depois (o pousio vale) ou "Não plantei" a soja. */
  | { kind: 'answer'; answer: CropId | 'sem_soja' }
  /** O que o satélite viu depois da soja (sem resposta, ou só "Plantei"). */
  | { kind: 'satellite'; situation: SituacaoAno }
  /** Sem satélite e sem resposta. */
  | { kind: 'missing' }

export type SeasonChartCell = { value: number | null; level: NdviLevel }

export type SeasonChartRow = {
  /** Ano da colheita da soja (2026 = safra 2025/26). */
  year: number
  /** As leituras de janeiro a julho; null = sem leitura do satélite (barra listrada). */
  cells: SeasonChartCell[] | null
  /** Uma das 3 safras que o produtor confirma (destaque leve). */
  confirmable: boolean
  status: SeasonChartStatus
}

export type SeasonChart = {
  /** Há NDVI no ponto: o gráfico mostra todas as safras com leitura (senão, só as 3 últimas, listradas). */
  readings: boolean
  /** "MM-DD" do começo de cada coluna. */
  columns: string[]
  /** Faixas de colunas `[de, até)` no topo: soja, colheita (uma coluna) e depois da soja. */
  marks: { soy: [number, number]; harvest: number | null; offseason: [number, number] }
  /** Primeira coluna e quantas colunas cada mês tem (1 = janeiro), para o eixo de cima. */
  months: { month: number; from: number; span: number }[]
  rows: SeasonChartRow[]
  /** A safra atual (2026/27): sempre a última linha, sem leitura, com o que o produtor pensa plantar. */
  current: { year: number; choice: CurrentChoice | null }
  /** Título: em quantas das safras com soja a terra ficou parada depois dela (a resposta vale no lugar do satélite). */
  idle: number
  total: number
}

export type SeasonChartInput = {
  /** `historico_ndvi` do `/raio-x`; null = sem NDVI no ponto. */
  strip: FaixaNdvi | null | undefined
  /** Histórico do `/talhao` (o que o satélite viu em cada ano). */
  historico: Historico | null
  answers: SeasonAnswers
  current: CurrentChoice | null | undefined
  /** "MM-DD" da colheita do produtor, para o gráfico sem NDVI (com NDVI, vale o dia em que a soja seca). */
  harvestDay?: string | null
}

function columnOf(columns: readonly string[], day: string): number {
  return Math.max(0, columns.findLastIndex((start) => start <= day))
}

function marksOf(columns: readonly string[], harvestDay: string | null | undefined): SeasonChart['marks'] {
  const harvest = harvestDay ? columnOf(columns, harvestDay) : null
  const fallback = columns.findIndex((start) => start >= OFFSEASON_FALLBACK)
  const start = harvest !== null ? harvest + 1 : fallback < 0 ? columns.length : fallback
  return { soy: [0, harvest ?? start], harvest, offseason: [start, columns.length] }
}

function monthsOf(columns: readonly string[]): SeasonChart['months'] {
  const months: SeasonChart['months'] = []
  columns.forEach((column, index) => {
    const month = Number(column.slice(0, 2))
    const last = months.at(-1)
    if (last?.month === month) last.span += 1
    else months.push({ month, from: index, span: 1 })
  })
  return months
}

function statusOf(answer: SeasonAnswers[number], situation: SituacaoAno | undefined): SeasonChartStatus {
  if (answer !== undefined && answer !== 'soja') return { kind: 'answer', answer }
  // Só "Plantei" (sem o depois): vale o que o satélite viu depois da soja, se ele viu a soja.
  if (situation && !(answer === 'soja' && situation === 'sem_soja')) return { kind: 'satellite', situation }
  return { kind: 'missing' }
}

/** A safra teve soja (e por isso entressafra): pela resposta ou, sem ela, pelo satélite. */
function hadSoy(status: SeasonChartStatus, answer: SeasonAnswers[number]): boolean {
  if (status.kind === 'answer') return status.answer !== 'sem_soja'
  if (status.kind === 'satellite') return status.situation !== 'sem_soja'
  return answer === 'soja'
}

const isIdle = (status: SeasonChartStatus) =>
  (status.kind === 'answer' && status.answer === 'pousio') || (status.kind === 'satellite' && status.situation === 'parado')

export function seasonChart({ strip, historico, answers, current, harvestDay }: SeasonChartInput): SeasonChart {
  const readings = Boolean(strip && strip.anos.length > 0)
  const columns = readings && strip ? strip.colunas : DEFAULT_COLUMNS
  const valuesByYear = new Map((readings && strip ? strip.anos : []).map((item) => [item.ano, item.valores]))
  const situationByYear = new Map((historico?.anos ?? []).map((item) => [item.ano, item.situacao]))
  const years = readings ? [...new Set([...valuesByYear.keys(), ...LAST_SEASONS])].sort((a, b) => a - b) : [...LAST_SEASONS]

  const rows = years.map((year): SeasonChartRow => {
    const values = valuesByYear.get(year)
    return {
      year,
      cells: values ? values.map((value) => ({ value, level: ndviLevel(value) })) : null,
      confirmable: LAST_SEASONS.includes(year),
      status: statusOf(answers[year], situationByYear.get(year)),
    }
  })
  const withSoy = rows.filter((item) => hadSoy(item.status, answers[item.year]))

  return {
    readings,
    columns,
    marks: marksOf(columns, readings && strip ? strip.colheita_dia : harvestDay),
    months: monthsOf(columns),
    rows,
    current: { year: CURRENT_SEASON, choice: current ?? null },
    idle: withSoy.filter((item) => isIdle(item.status)).length,
    total: withSoy.length,
  }
}
