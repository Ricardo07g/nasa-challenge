import type { AnoDetalhe, EnsoAcerto, Opcao } from '../models/recomendacao'

/**
 * Explorador ano a ano do "Por que essa sugestão?" (tela 5; antes, a aba Sugestão da tarefa 0044): uma barra
 * por ano com a água na fase crítica (o ISNA do motor) e a linha de corte do critério, o ano tocado e as fases
 * do El Niño / La Niña com diferença clara. Só o que a API manda: nenhum corte novo no navegador.
 */

const PERCENT = 100

export type YearBar = {
  year: number
  /** Água na fase crítica em % do que a planta precisa (o ISNA do motor). */
  pct: number
  good: boolean
  /** Por que o ano apertou (null quando deu certo). */
  reason: 'agua' | 'calor' | 'ambos' | null
  enso: 'el_nino' | 'la_nina' | null
}

function reasonOf(detail: AnoDetalhe): YearBar['reason'] {
  if (detail.bom) return null
  if (detail.falta_agua && detail.calor) return 'ambos'
  return detail.calor ? 'calor' : 'agua'
}

/** Explorador ano a ano: uma barra por ano e a linha de corte do motor; null sem o ISNA ou o critério. */
export function yearBars(option: Opcao): { bars: YearBar[]; cutPct: number } | null {
  const details = option.anos_detalhe ?? []
  if (!option.criterio || details.length === 0 || details.some((d) => d.isna === undefined)) return null
  return {
    cutPct: Math.round(option.criterio.isna_min * PERCENT),
    bars: details.map((detail) => ({
      year: detail.ano,
      pct: Math.round((detail.isna ?? 0) * PERCENT),
      good: detail.bom,
      reason: reasonOf(detail),
      enso: detail.enso,
    })),
  }
}

/** O ano tocado no explorador, se está na série da opção. */
export function selectedYear(option: Opcao, year: number | null): AnoDetalhe | null {
  if (year === null) return null
  return option.anos_detalhe?.find((detail) => detail.ano === year) ?? null
}

/** El Niño / La Niña: só as fases em que a diferença para os outros anos é clara (critério do motor). */
export function clearEnsoNotes(option: Opcao): EnsoAcerto[] {
  return (option.enso_acerto ?? []).filter((item) => item.clara)
}
