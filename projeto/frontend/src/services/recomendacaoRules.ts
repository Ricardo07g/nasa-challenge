import type { CropId, Eixo, Opcao, Recomendacao } from '../models/recomendacao'

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

export function findOption(options: readonly Opcao[], id: CropId): Opcao | undefined {
  return options.find((option) => option.id === id)
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
