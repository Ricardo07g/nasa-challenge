import type { CropId, Objetivo, Opcao, Recomendacao, Sede } from '../models/recomendacao'
import { MAX_COMPARED } from './cropListParams'
import { rankForObjective } from './suggestionService'

/**
 * Aba Comparar (seção 5.5 da remodelagem, tarefa 0045): até 3 culturas lado a lado. A ordem vem pronta do
 * motor (`objetivos`); as linhas usam só o que a API manda. "Por que usar" e "Por que evitar" saem dos
 * rótulos do motor (cortes do `regras.yaml`), da sede da cultura e do clima de 2041–2060: nenhum número
 * novo no navegador.
 */

/** Artigos do Guia da linha Terra (tabela "Links nas telas" da seção 8). */
export const COMPARE_ARTICLES = {
  straw: '/guia/palhada',
  greenManure: '/guia/adubo-verde',
  nematode: '/guia/nematoide',
} as const

/** As culturas comparadas: as da URL que cabem na janela desta colheita; sem nenhuma, as 3 melhores do objetivo. */
export function comparedCrops(recomendacao: Recomendacao, objetivo: Objetivo | null, fromUrl: readonly CropId[] | undefined): CropId[] {
  const ranked = rankForObjective(recomendacao, objetivo).map((option) => option.id)
  const chosen = (fromUrl ?? []).filter((crop) => ranked.includes(crop))
  return chosen.length ? chosen.slice(0, MAX_COMPARED) : ranked.slice(0, MAX_COMPARED)
}

export type CompareChip = {
  id: CropId
  nome: string
  sede: Sede | null
  selected: boolean
  /** Fora da janela de plantio: desligado, com a data limite do ZARC (ISO; null sem a data). */
  disabled: boolean
  limit: string | null
}

/** Um chip por cultura: as da janela na ordem do objetivo; depois, as que já passaram do prazo, desligadas. */
export function compareChips(recomendacao: Recomendacao, objetivo: Objetivo | null, selected: readonly CropId[]): CompareChip[] {
  const inWindow = rankForObjective(recomendacao, objetivo).map((option) => ({
    id: option.id,
    nome: option.nome,
    sede: option.agua?.sede ?? null,
    selected: selected.includes(option.id),
    disabled: false,
    limit: option.data_limite,
  }))
  const late = recomendacao.fora_da_janela.map((item) => ({
    id: item.id,
    nome: item.nome,
    sede: null,
    selected: false,
    disabled: true,
    limit: item.data_limite ?? null,
  }))
  return [...inWindow, ...late]
}

/** Tocar no chip: põe (até 3) ou tira (sempre fica pelo menos uma). */
export function toggleCompared(selected: readonly CropId[], crop: CropId): CropId[] {
  if (selected.includes(crop)) return selected.length > 1 ? selected.filter((id) => id !== crop) : [...selected]
  return selected.length < MAX_COMPARED ? [...selected, crop] : [...selected]
}

/** Por que falhou: anos por falta de água e anos por calor (um ano pode ter os dois); null sem o explorador. */
export function failureCounts(option: Opcao): { water: number; heat: number; failed: number } | null {
  const details = option.anos_detalhe ?? []
  if (details.length === 0) return null
  const failed = details.filter((detail) => !detail.bom)
  return {
    water: failed.filter((detail) => detail.falta_agua).length,
    heat: failed.filter((detail) => detail.calor).length,
    failed: failed.length,
  }
}

export type UseReason = 'safe' | 'grain' | 'soil' | 'littleWater'
export type AvoidReason = 'risky' | 'noGrain' | 'soilWeak' | 'muchWater' | 'futureWorse'

/** "Por que usar": rótulo Bom na chuva, grão com renda Bom, terra Bom e pouca sede. */
export function whyUse(option: Opcao): UseReason[] {
  const reasons: UseReason[] = []
  if (option.chuva.rotulo === 'bom') reasons.push('safe')
  if (option.renda.da_grao && option.renda.rotulo === 'bom') reasons.push('grain')
  if (option.terra.rotulo === 'bom') reasons.push('soil')
  if (option.agua?.sede === 'pouca') reasons.push('littleWater')
  return reasons
}

/** "Por que evitar": chuva Fraco, sem grão, terra Fraco, muita sede e menos anos bons em 2041–2060. */
export function whyAvoid(option: Opcao): AvoidReason[] {
  const reasons: AvoidReason[] = []
  if (option.chuva.rotulo === 'fraco') reasons.push('risky')
  if (!option.renda.da_grao) reasons.push('noGrain')
  if (option.terra.rotulo === 'fraco') reasons.push('soilWeak')
  if (option.agua?.sede === 'muita') reasons.push('muchWater')
  if (option.futuro && option.futuro.anos_bons_media < option.chuva.anos_bons) reasons.push('futureWorse')
  return reasons
}
