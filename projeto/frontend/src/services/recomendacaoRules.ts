import type { CropId, Eixo, Motivo, Opcao, Recomendacao } from '../models/recomendacao'

const byFinal = (a: Opcao, b: Opcao) => b.notas.final - a.notas.final

const byAxis: Record<Eixo, (a: Opcao, b: Opcao) => number> = {
  chuva: (a, b) => b.chuva.anos_bons - a.chuva.anos_bons,
  renda: (a, b) => b.notas.renda - a.notas.renda,
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
      return [option.chuva.texto, option.renda.texto]
    case 'mais_renda':
      return [option.renda.texto, option.renda.risco]
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

export type FutureSummary = {
  /** Anos em que daria certo (média dos modelos). */
  good: number
  total: number
  /** Faixa entre os modelos; null quando todos dão o mesmo número. */
  range: { min: number; max: number } | null
}

/**
 * Clima de 2041–2060 (NEX-GDDP-CMIP6): em quantos anos a opção daria certo, com a faixa entre os
 * modelos. O total de anos é o mesmo da chuva de hoje. Sem o dado do CMIP6 na API, null.
 */
export function futureSummary(option: Opcao): FutureSummary | null {
  if (!option.futuro) return null
  const { anos_bons_media, anos_bons_min, anos_bons_max } = option.futuro
  return {
    good: anos_bons_media,
    total: option.chuva.anos,
    range: anos_bons_min === anos_bons_max ? null : { min: anos_bons_min, max: anos_bons_max },
  }
}

/**
 * Tela 9 (para o agrônomo): as notas de 0 a 100 de cada opção no prazo, da maior nota final para a menor.
 * Desde a tarefa 0056 o `/recomendacao` traz também as culturas fora do prazo (`na_janela: false`), que ficam de fora.
 */
export function scoreRows(recomendacao: Recomendacao): { id: CropId; nome: string; notas: Opcao['notas'] }[] {
  return recomendacao.opcoes
    .filter((opcao) => opcao.na_janela !== false)
    .sort(byFinal)
    .map(({ id, nome, notas }) => ({ id, nome, notas }))
}
