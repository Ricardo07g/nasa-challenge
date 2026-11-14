import { COVER_CROPS, GRAIN_CROPS, type CropId, type Eixo, type Motivo, type Opcao } from '../models/recomendacao'

const byFinal = (a: Opcao, b: Opcao) => b.notas.final - a.notas.final

const byAxis: Record<Eixo, (a: Opcao, b: Opcao) => number> = {
  chuva: (a, b) => b.chuva.anos_bons - a.chuva.anos_bons,
  dinheiro: (a, b) => b.dinheiro.margem_ha - a.dinheiro.margem_ha,
  terra: (a, b) => b.terra.nota - a.terra.nota,
}

/**
 * Tela 6: "colocar na frente quem é melhor em…". Sem eixo, vale a nota final (pesos padrão do motor).
 * Empates no eixo escolhido são desfeitos pela nota final (RF-05: reordenar é no navegador).
 */
export function sortOptions(options: readonly Opcao[], axis: Eixo | null): Opcao[] {
  const sorted = [...options]
  if (axis === null) return sorted.sort(byFinal)
  return sorted.sort((a, b) => byAxis[axis](a, b) || byFinal(a, b))
}

/** O que cada alternativa "Se você prefere…" destaca (tela 5). */
export function alternativeSummary(motive: Motivo, option: Opcao): string[] {
  switch (motive) {
    case 'menos_risco':
      return [option.chuva.texto, option.dinheiro.texto]
    case 'mais_dinheiro':
      return [option.dinheiro.texto, option.terra.texto]
    case 'cuidar_da_terra':
      return [option.terra.texto]
  }
}

export function findOption(options: readonly Opcao[], id: CropId): Opcao | undefined {
  return options.find((option) => option.id === id)
}

/** Ano da soja que vem antes da entressafra (a semeadura da opção é logo depois da colheita). */
export function harvestYear(sowingDate: string): number {
  return Number(sowingDate.slice(0, 4))
}

/** Tela 7: "Com plano": em quantos anos tem grão e em quantos a terra fica coberta (PRD §5). */
export function planSummary(years: readonly CropId[]): { grain: number; covered: number; total: number } {
  return {
    grain: years.filter((id) => GRAIN_CROPS.has(id)).length,
    covered: years.filter((id) => COVER_CROPS.has(id)).length,
    total: years.length,
  }
}

/** Tela 7: o que o plano troca quando vem um ano seco. */
export function planSwaps(
  normal: readonly CropId[],
  dry: readonly CropId[],
  firstYear: number,
): { year: number; from: CropId; to: CropId }[] {
  return normal.flatMap((from, index) =>
    dry[index] !== undefined && dry[index] !== from ? [{ year: firstYear + index, from, to: dry[index] }] : [],
  )
}
