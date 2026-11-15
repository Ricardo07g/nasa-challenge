import type { Lang } from '../i18n/language'
import type { CustoAtraso, CustoAtrasoParams } from '../models/custoAtraso'
import type { Colheita } from '../models/talhao'
import { custoAtrasoRepository as defaultRepository } from '../repositories'
import type { CustoAtrasoRepository } from '../repositories/custoAtrasoRepository'

export type DelayCostService = {
  get(params: CustoAtrasoParams, lang: Lang): Promise<CustoAtraso>
}

/** Custo do atraso da colheita (tela 3): o motor do backend roda as 3 faixas (`/api/custo-atraso`). */
export function createDelayCostService(repository: CustoAtrasoRepository = defaultRepository): DelayCostService {
  return { get: (params, lang) => repository.get(params, lang) }
}

export const delayCostService = createDelayCostService()

export type DelayCostBand = { band: Colheita; crop: string; good: number; total: number }

/** As faixas com opção na janela de plantio, em ordem, e se a melhor opção é a mesma nas três. */
export type DelayCost = { bands: DelayCostBand[]; sameCrop: boolean }

/**
 * "Colhendo cedo, deu certo em A de 20 anos; no meio, B de 20; tarde, C de 20." Os números são os do
 * motor (melhor opção de cada faixa); nada é recalculado aqui. A faixa sem opção na janela de plantio
 * fica de fora; sem nenhuma, null (o bloco não aparece).
 */
export function delayCost(custo: CustoAtraso | undefined): DelayCost | null {
  if (!custo) return null
  const bands = custo.faixas.flatMap((faixa) =>
    faixa.melhor && faixa.anos_bons !== null && faixa.total_anos !== null
      ? [{ band: faixa.colheita, crop: faixa.melhor, good: faixa.anos_bons, total: faixa.total_anos }]
      : [],
  )
  return bands.length > 0 ? { bands, sameCrop: custo.mesma_cultura } : null
}
