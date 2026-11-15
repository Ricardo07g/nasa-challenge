import type { Talhao } from '../models/talhao'

const SOURCE_SEPARATOR = '+'
/** Ano comum só para escrever "21 de abril" (a API manda "MM-DD" de um ano sem 29/fev). */
const COMMON_YEAR = 2023

/** Um ponto da curva: a chuva que sobra colhendo naquele dia ("MM-DD"), na mediana e num ano seco. */
export type RainLeftPoint = { day: string; median: number; dry: number }

/** A curva da chuva que sobra para todos os dias da tabela, sem dia escolhido (o gráfico abre sem data). */
export type RainLeftCurve = {
  /** Último dia somado ("MM-DD") e o percentil do ano seco. */
  endDay: string
  percentile: number
  firstYear: number
  lastYear: number
  years: number
  /** Chaves das fontes da chuva (ex.: `gpm_imerg`). */
  sources: string[]
  /** A curva inteira, de 15/jan a 31/mar, para o gráfico. */
  points: RainLeftPoint[]
  maxMm: number
}

export type RainLeft = RainLeftCurve & {
  /** O dia da colheita usado (ISO). */
  date: string
  /** Chuva do dia até o fim de junho: mediana dos anos e um ano seco, em mm inteiros. */
  medianMm: number
  dryMm: number
  /** O dia escolhido em `points`. */
  selectedIndex: number
}

/**
 * A curva da "chuva que sobra" a partir do `chuva_que_sobra` do talhão (a regra fica no backend: tarefa
 * 0042). Sem o campo ou sem anos: null, e o bloco não aparece (decisão D2).
 */
export function rainLeftCurve(talhao: Talhao | undefined): RainLeftCurve | null {
  const sobra = talhao?.chuva_que_sobra
  if (!sobra || sobra.anos.length === 0) return null
  const points = sobra.dias.map((dia) => ({ day: dia.dia, median: dia.mediana_mm, dry: dia.seco_mm }))
  return {
    endDay: sobra.fim,
    percentile: sobra.percentil_seco,
    firstYear: Math.min(...sobra.anos),
    lastYear: Math.max(...sobra.anos),
    years: sobra.anos.length,
    sources: sobra.fonte.split(SOURCE_SEPARATOR),
    points,
    maxMm: Math.max(...points.map((point) => point.median)),
  }
}

/**
 * "Chuva que sobra depois da colheita" para o dia escolhido. 29/fev usa o dia 28. Sem o campo, sem anos ou
 * com o dia fora da tabela (de 15/jan a 31/mar): null, e o número não aparece (decisão D2).
 */
export function rainLeft(talhao: Talhao | undefined, isoDate: string): RainLeft | null {
  const curve = rainLeftCurve(talhao)
  if (!curve || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const monthDay = isoDate.slice(5) === '02-29' ? '02-28' : isoDate.slice(5)
  const selectedIndex = curve.points.findIndex((point) => point.day === monthDay)
  if (selectedIndex < 0) return null
  const selected = curve.points[selectedIndex]
  return {
    ...curve,
    date: isoDate,
    medianMm: Math.round(selected.median),
    dryMm: Math.round(selected.dry),
    selectedIndex,
  }
}

export type RainEnd = {
  /** Em metade dos anos, a chuva acabou até esse dia (ISO num ano comum, para escrever o dia e o mês). */
  median: string
  earliest: { date: string; year: number }
  latest: { date: string; year: number }
  firstYear: number
  lastYear: number
  years: number
  sources: string[]
  /** A regra do backend: a partir de `startDate`, `days` dias seguidos com menos de `maxMm` mm somados. */
  startDate: string
  days: number
  maxMm: number
}

/** Fim das chuvas na célula (tela 3), a partir do `fim_das_chuvas` do talhão; null sem o dado. */
export function rainEnd(talhao: Talhao | undefined): RainEnd | null {
  const fim = talhao?.fim_das_chuvas
  if (!fim || fim.anos.length === 0) return null
  return {
    median: `${COMMON_YEAR}-${fim.mediana}`,
    earliest: { date: `${fim.mais_cedo.ano}-${fim.mais_cedo.dia}`, year: fim.mais_cedo.ano },
    latest: { date: `${fim.mais_tarde.ano}-${fim.mais_tarde.dia}`, year: fim.mais_tarde.ano },
    firstYear: Math.min(...fim.anos),
    lastYear: Math.max(...fim.anos),
    years: fim.anos.length,
    sources: fim.fonte.split(SOURCE_SEPARATOR),
    startDate: `${COMMON_YEAR}-${fim.inicio}`,
    days: fim.dias,
    maxMm: fim.chuva_max_mm,
  }
}
