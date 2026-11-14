import {
  COVER_CROPS,
  GRAIN_CROPS,
  type CropId,
  type Eixo,
  type Motivo,
  type Opcao,
  type Recomendacao,
} from '../models/recomendacao'

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

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`)

export type LateSummary = { names: string[]; texts: string[] }

/** Opções que já passaram da janela de plantio (colheita tardia), para o aviso laranja. */
function lateSummary(recomendacao: Recomendacao): LateSummary {
  return {
    names: recomendacao.fora_da_janela.map((item) => item.nome),
    texts: recomendacao.fora_da_janela.map((item) => item.texto),
  }
}

export type AnswerSummary = {
  /** Ano da soja que vem antes da entressafra ("Depois da soja de 2027…"). */
  year: number
  best: Opcao
  alternatives: { motivo: Motivo; option: Opcao; text: string }[]
  late: LateSummary
}

/** Tela 5: o que a resposta mostra. Sem a melhor opção na lista, não há resposta. */
export function buildAnswer(recomendacao: Recomendacao): AnswerSummary | null {
  const best = findOption(recomendacao.opcoes, recomendacao.melhor)
  if (!best) return null
  return {
    year: harvestYear(recomendacao.entrada.semeadura),
    best,
    alternatives: recomendacao.alternativas.flatMap(({ motivo, opcao }) => {
      const option = findOption(recomendacao.opcoes, opcao)
      return option ? [{ motivo, option, text: alternativeSummary(motivo, option).map(sentence).join(' ') }] : []
    }),
    late: lateSummary(recomendacao),
  }
}

/**
 * Tela 6: todas as opções. As que cabem na janela de plantio vêm na ordem do eixo escolhido (sem eixo,
 * nota final); as que não cabem vão para o fim.
 */
export function optionsSummary(recomendacao: Recomendacao, axis: Eixo | null): { options: Opcao[]; late: LateSummary } {
  const inWindow = recomendacao.opcoes.filter((option) => option.na_janela)
  const outOfWindow = recomendacao.opcoes.filter((option) => !option.na_janela)
  return { options: [...sortOptions(inWindow, axis), ...outOfWindow], late: lateSummary(recomendacao) }
}

export type PlanScenario = 'normal' | 'seco'

/** Pedaço da lavoura para começar o plano ("Comece por um pedaço"). */
export type PlanArea = '50' | '100' | 'all'

export type PlanView = {
  years: { year: number; crop: CropId; swappedFrom: CropId | null }[]
  summary: { grain: number; covered: number; total: number }
  swaps: { year: number; from: CropId; to: CropId }[]
  today: string
}

/** Tela 7: o plano de 3 anos no cenário escolhido (ano normal ou ano seco), a partir da soja que vem. */
export function buildPlan(recomendacao: Recomendacao, scenario: PlanScenario): PlanView {
  const { normal, seco, hoje } = recomendacao.plano_3_anos
  const firstYear = harvestYear(recomendacao.entrada.semeadura)
  const anos = scenario === 'seco' ? seco.anos : normal.anos
  return {
    years: anos.map((crop, index) => ({
      year: firstYear + index,
      crop,
      swappedFrom: scenario === 'seco' && normal.anos[index] !== crop ? normal.anos[index] : null,
    })),
    summary: planSummary(anos),
    swaps: scenario === 'seco' ? planSwaps(normal.anos, seco.anos, firstYear) : [],
    today: hoje.descricao,
  }
}

/** Tela 9 (para o agrônomo): as notas de 0 a 100 de cada opção, da maior nota final para a menor. */
export function scoreRows(recomendacao: Recomendacao): { id: CropId; nome: string; notas: Opcao['notas'] }[] {
  return [...recomendacao.opcoes].sort(byFinal).map(({ id, nome, notas }) => ({ id, nome, notas }))
}
