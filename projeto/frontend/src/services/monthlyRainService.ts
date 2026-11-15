import type { Talhao } from '../models/talhao'

export type RainMonth = 'jan' | 'feb' | 'mar' | 'apr' | 'may' | 'jun'

/** Mês da API (1 = janeiro) → chave do gráfico. O gráfico vai de janeiro a junho (protótipo da tela 3). */
const MONTHS: Record<number, RainMonth> = { 1: 'jan', 2: 'feb', 3: 'mar', 4: 'apr', 5: 'may', 6: 'jun' }

const SOURCE_SEPARATOR = '+'

export type RainChart = {
  /** `mm` arredondado para escrever em cima da barra; `heightPct` = altura em % do mês mais chuvoso. */
  bars: { month: RainMonth; mm: number; heightPct: number }[]
  firstYear: number
  lastYear: number
  /** Quantos anos entraram na média (pode faltar ano no meio). */
  years: number
  /** Chaves das fontes da chuva (ex.: `nasa_power`). */
  sources: string[]
}

/**
 * Gráfico "Chuva de cada mês na região" (tela 3) a partir do `chuva_mensal` do talhão. Sem o campo
 * (API que ainda não manda), com null, sem meses de janeiro a junho ou sem anos: null, e o gráfico não
 * aparece (decisão D2).
 */
export function rainChart(talhao: Talhao | undefined): RainChart | null {
  const chuva = talhao?.chuva_mensal
  if (!chuva || chuva.anos.length === 0) return null
  const months = chuva.meses.filter((mes) => mes.mes in MONTHS).sort((a, b) => a.mes - b.mes)
  if (months.length === 0) return null
  const max = Math.max(...months.map((mes) => mes.media_mm))
  return {
    bars: months.map((mes) => ({
      month: MONTHS[mes.mes],
      mm: Math.round(mes.media_mm),
      heightPct: max > 0 ? Math.round((mes.media_mm / max) * 100) : 0,
    })),
    firstYear: Math.min(...chuva.anos),
    lastYear: Math.max(...chuva.anos),
    years: chuva.anos.length,
    sources: chuva.fonte.split(SOURCE_SEPARATOR),
  }
}
