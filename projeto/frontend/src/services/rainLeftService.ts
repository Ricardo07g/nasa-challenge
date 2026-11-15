import type { Talhao } from '../models/talhao'

const SOURCE_SEPARATOR = '+'
/** Ano comum só para escrever "21 de abril" (a API manda "MM-DD" de um ano sem 29/fev). */
const COMMON_YEAR = 2023

/** Um ponto da curva: a chuva que sobra colhendo naquele dia ("MM-DD"), na mediana e num ano seco. */
export type RainLeftPoint = { day: string; median: number; dry: number }

export type RainLeft = {
  /** O dia da colheita usado (ISO). */
  date: string
  /** Chuva do dia até o fim de junho: mediana dos anos e um ano seco, em mm inteiros. */
  medianMm: number
  dryMm: number
  /** Último dia somado ("MM-DD") e o percentil do ano seco. */
  endDay: string
  percentile: number
  firstYear: number
  lastYear: number
  years: number
  /** Chaves das fontes da chuva (ex.: `gpm_imerg`). */
  sources: string[]
  /** A curva inteira, de 15/jan a 31/mar, para o gráfico; `selectedIndex` é o dia escolhido. */
  points: RainLeftPoint[]
  maxMm: number
  selectedIndex: number
}

/**
 * "Chuva que sobra depois da colheita" (tela 3) para o dia escolhido, a partir do `chuva_que_sobra` do
 * talhão (a regra fica no backend: tarefa 0042). 29/fev usa o dia 28. Sem o campo, sem anos ou com o
 * dia fora da tabela: null, e o bloco não aparece (decisão D2).
 */
export function rainLeft(talhao: Talhao | undefined, isoDate: string): RainLeft | null {
  const sobra = talhao?.chuva_que_sobra
  if (!sobra || sobra.anos.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const monthDay = isoDate.slice(5) === '02-29' ? '02-28' : isoDate.slice(5)
  const selectedIndex = sobra.dias.findIndex((dia) => dia.dia === monthDay)
  if (selectedIndex < 0) return null
  const selected = sobra.dias[selectedIndex]
  const points = sobra.dias.map((dia) => ({ day: dia.dia, median: dia.mediana_mm, dry: dia.seco_mm }))
  return {
    date: isoDate,
    medianMm: Math.round(selected.mediana_mm),
    dryMm: Math.round(selected.seco_mm),
    endDay: sobra.fim,
    percentile: sobra.percentil_seco,
    firstYear: Math.min(...sobra.anos),
    lastYear: Math.max(...sobra.anos),
    years: sobra.anos.length,
    sources: sobra.fonte.split(SOURCE_SEPARATOR),
    points,
    maxMm: Math.max(...points.map((point) => point.median)),
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
