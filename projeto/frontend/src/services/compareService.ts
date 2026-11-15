import type { Opcao } from '../models/recomendacao'

/**
 * Pontos a favor e contra de cada cultura (tela 5, "Comparar até 3"; antes, a aba Comparar da tarefa 0045). Saem
 * dos rótulos do motor (cortes do `regras.yaml`), da sede da cultura e do clima de 2041–2060: nenhum número novo
 * no navegador.
 */

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
