import type { Talhao } from '../models/talhao'

export type RainMonth = 'jan' | 'feb' | 'mar' | 'apr' | 'may' | 'jun'

/** Mês da API (1 = janeiro) → chave do gráfico. O gráfico vai de janeiro a junho (protótipo da tela 3). */
const MONTHS: Record<number, RainMonth> = { 1: 'jan', 2: 'feb', 3: 'mar', 4: 'apr', 5: 'may', 6: 'jun' }

const SOURCE_SEPARATOR = '+'

export type RainBar = {
  month: RainMonth
  /** `mm` arredondado para escrever em cima da barra; `heightPct` = altura em % da maior barra. */
  mm: number
  heightPct: number
  /** O que a lavoura gasta no mês (ETo), na mesma escala; só com a ETo de todos os meses. */
  etoMm?: number
  etoHeightPct?: number
}

export type RainChart = {
  bars: RainBar[]
  firstYear: number
  lastYear: number
  /** Quantos anos entraram na média (pode faltar ano no meio). */
  years: number
  /** Chaves das fontes da chuva (ex.: `gpm_imerg`). */
  sources: string[]
  /** Com a ETo (tarefa 0042): a fonte e o primeiro mês em que a chuva fica menor que o gasto. */
  eto?: { source: string; deficitMonth: RainMonth | null }
}

const pct = (value: number, max: number) => (max > 0 ? Math.round((value / max) * 100) : 0)

/**
 * Gráfico "Chuva e o que a lavoura gasta, mês a mês" (tela 3) a partir do `chuva_mensal` do talhão. Sem
 * o campo, com null, sem meses de janeiro a junho ou sem anos: null, e o gráfico não aparece (decisão
 * D2). A ETo só entra com o valor de todos os meses e a fonte; o mês em destaque vem do backend
 * (`mes_chuva_abaixo_eto`: a regra fica lá).
 */
export function rainChart(talhao: Talhao | undefined): RainChart | null {
  const chuva = talhao?.chuva_mensal
  if (!chuva || chuva.anos.length === 0) return null
  const months = chuva.meses.filter((mes) => mes.mes in MONTHS).sort((a, b) => a.mes - b.mes)
  if (months.length === 0) return null
  const withEto = Boolean(chuva.fonte_eto) && months.every((mes) => typeof mes.eto_media_mm === 'number')
  const max = Math.max(...months.flatMap((mes) => (withEto ? [mes.media_mm, mes.eto_media_mm!] : [mes.media_mm])))
  const chart: RainChart = {
    bars: months.map((mes) => ({
      month: MONTHS[mes.mes],
      mm: Math.round(mes.media_mm),
      heightPct: pct(mes.media_mm, max),
      ...(withEto ? { etoMm: Math.round(mes.eto_media_mm!), etoHeightPct: pct(mes.eto_media_mm!, max) } : {}),
    })),
    firstYear: Math.min(...chuva.anos),
    lastYear: Math.max(...chuva.anos),
    years: chuva.anos.length,
    sources: chuva.fonte.split(SOURCE_SEPARATOR),
  }
  if (withEto) {
    const deficit = chuva.mes_chuva_abaixo_eto
    chart.eto = { source: chuva.fonte_eto!, deficitMonth: deficit && deficit in MONTHS ? MONTHS[deficit] : null }
  }
  return chart
}
