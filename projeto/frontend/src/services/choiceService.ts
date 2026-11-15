import type { CropId, Eixo, Objetivo, Opcao, Recomendacao } from '../models/recomendacao'
import { whyAvoid, type AvoidReason } from './compareService'
import { MAX_COMPARED } from './cropListParams'
import type { FlowParams } from './flowParams'
import { findOption, sortOptions } from './recomendacaoRules'
import { currentChoiceCrop } from './seasonAnswersService'

/**
 * Aba "1. Escolher" da tela 5 (pacote 2): a sugestão, o "Comparar até 3" e a cultura escolhida para o plano.
 * A ordem das opções vem pronta do motor (`objetivos`, tarefa 0044) e, desde a tarefa 0056, as culturas fora do
 * prazo do ZARC também vêm com a conta, depois das que estão no prazo: dá para comparar e escolher, sempre com o
 * aviso. A sugestão nunca é uma delas. O estado fica na URL (`escolha`, `comparar`, `objetivo`).
 */

/** "Deixar parado": não é uma opção do motor, mas pode ser comparado e escolhido. */
export const FALLOW: CropId = 'pousio'

/** Passou do prazo do ZARC: o campo da API ou, numa API antiga, fora da janela. */
export function isLate(option: Pick<Opcao, 'na_janela' | 'fora_do_prazo'>): boolean {
  return option.fora_do_prazo ?? !option.na_janela
}

/** Eixo da regra antiga do navegador para cada objetivo (só sem os `objetivos` da API). */
const AXIS_OF: Record<Objetivo, Eixo> = { seguranca: 'chuva', renda: 'renda', terra: 'terra' }

/** Todas as opções na ordem do motor para o objetivo (null = equilíbrio): as no prazo e, depois, as fora do prazo. */
export function rankAll(recomendacao: Recomendacao, objetivo: Objetivo | null): Opcao[] {
  const inTime = recomendacao.opcoes.filter((option) => !isLate(option))
  const late = recomendacao.opcoes.filter(isLate)
  const ordem = recomendacao.objetivos?.[objetivo ?? 'equilibrio']?.ordem
  if (!ordem) return [...sortOptions(inTime, objetivo ? AXIS_OF[objetivo] : null), ...late]
  const ordered = ordem.flatMap((id) => findOption(recomendacao.opcoes, id) ?? [])
  const rest = recomendacao.opcoes.filter((option) => !ordem.includes(option.id))
  return [...ordered, ...rest].sort((a, b) => Number(isLate(a)) - Number(isLate(b)))
}

/** A sugestão: a 1ª do objetivo que está no prazo (nunca uma fora do prazo); null sem nenhuma no prazo. */
export function suggestionOf(recomendacao: Recomendacao, objetivo: Objetivo | null): Opcao | null {
  return rankAll(recomendacao, objetivo).find((option) => !isLate(option)) ?? null
}

/** As culturas que dá para comparar e escolher: as da recomendação, na ordem, e o "Deixar parado". */
export function availableCrops(recomendacao: Recomendacao, objetivo: Objetivo | null): CropId[] {
  return [...rankAll(recomendacao, objetivo).map((option) => option.id), FALLOW]
}

/**
 * A cultura do 1º ano do plano: a escolhida na tela (`escolha`), senão a escolha atual do raio-X (`pensa`),
 * senão a sugestão. Uma cultura que a recomendação não tem (API antiga, sem as fora do prazo) não vale.
 */
export function planChoice(
  recomendacao: Recomendacao,
  objetivo: Objetivo | null,
  params: Pick<FlowParams, 'escolha' | 'pensa'>,
): CropId | null {
  const available = availableCrops(recomendacao, objetivo)
  const valid = (crop: CropId | null | undefined) => (crop && available.includes(crop) ? crop : null)
  return valid(params.escolha) ?? valid(currentChoiceCrop(params.pensa)) ?? suggestionOf(recomendacao, objetivo)?.id ?? null
}

/** A comparação de partida: a escolha e a sugestão; se forem a mesma cultura, entra a próxima do ranking. */
export function defaultCompared(ranked: readonly CropId[], choice: CropId, suggestion: CropId): CropId[] {
  if (choice !== suggestion) return [choice, suggestion]
  const next = ranked.find((crop) => crop !== choice)
  return next ? [choice, next] : [choice]
}

/** As culturas comparadas: as da URL que existem (até 3); sem nenhuma, a comparação de partida. */
export function comparedCrops(
  recomendacao: Recomendacao,
  objetivo: Objetivo | null,
  params: Pick<FlowParams, 'comparar' | 'escolha' | 'pensa'>,
): CropId[] {
  const available = availableCrops(recomendacao, objetivo)
  const fromUrl = (params.comparar ?? []).filter((crop) => available.includes(crop)).slice(0, MAX_COMPARED)
  if (fromUrl.length) return fromUrl
  const suggestion = suggestionOf(recomendacao, objetivo)?.id
  const choice = planChoice(recomendacao, objetivo, params)
  if (!suggestion || !choice) return available.slice(0, 1)
  return defaultCompared(available, choice, suggestion)
}

/** Marcar ou desmarcar uma caixinha: no máximo 3 e pelo menos 1. */
export function toggleCompared(selected: readonly CropId[], crop: CropId): CropId[] {
  if (selected.includes(crop)) return selected.length > 1 ? selected.filter((id) => id !== crop) : [...selected]
  return selected.length < MAX_COMPARED ? [...selected, crop] : [...selected]
}

/** A cultura escolhida entra na comparação; com 3, troca a última que não é a sugestão. */
export function withCompared(selected: readonly CropId[], crop: CropId, suggestion: CropId | null): CropId[] {
  if (selected.includes(crop)) return [...selected]
  if (selected.length < MAX_COMPARED) return [...selected, crop]
  const index = selected.findLastIndex((id) => id !== suggestion)
  return selected.map((id, i) => (i === index ? crop : id))
}

export type PickerItem = {
  id: CropId
  selected: boolean
  /** Com 3 marcadas, as outras desligam; a única marcada também (mínimo de 1). */
  disabled: boolean
  /** Etiquetas pequenas: "sua escolha", "sugestão" e "fora do prazo". */
  choice: boolean
  suggestion: boolean
  late: boolean
}

/** As caixinhas da linha "Comparar:", na ordem das culturas. */
export function pickerItems(
  crops: readonly CropId[],
  selected: readonly CropId[],
  choice: CropId | null,
  suggestion: CropId | null,
  late: ReadonlySet<CropId>,
): PickerItem[] {
  const full = selected.length >= MAX_COMPARED
  return crops.map((id) => {
    const isSelected = selected.includes(id)
    return {
      id,
      selected: isSelected,
      disabled: isSelected ? selected.length === 1 : full,
      choice: id === choice,
      suggestion: id === suggestion,
      late: late.has(id),
    }
  })
}

/**
 * "Essa é a escolha para o meu plano" / "Usar no meu plano": grava a escolha, congela a comparação que está na
 * tela com ela (a coluna não some debaixo do dedo) e solta os anos 2 e 3 (a sugestão em cadeia recomeça).
 */
export function choiceFlow<T extends FlowParams>(params: T, crop: CropId, compared: readonly CropId[], suggestion: CropId | null): T {
  return { ...params, escolha: crop, comparar: withCompared(compared, crop, suggestion), ano2: undefined, ano3: undefined }
}

/**
 * Trocar o "O que você quer mais?": a comparação volta ao padrão (com a sugestão nova). Sem a escolha gravada, o
 * 1º ano segue a sugestão nova, então os anos 2 e 3 também recomeçam.
 */
export function objectiveFlow<T extends FlowParams>(params: T, objetivo: Objetivo | null): T {
  const next = { ...params, objetivo: objetivo ?? undefined, comparar: undefined }
  return params.escolha ? next : { ...next, ano2: undefined, ano3: undefined }
}

export function comparedFlow<T extends FlowParams>(params: T, compared: readonly CropId[]): T {
  return { ...params, comparar: [...compared] }
}

export type ConReason = AvoidReason | 'late'

/** "Contra": passou do prazo (sem seguro) primeiro, depois os rótulos do motor. */
export function consOf(option: Opcao): ConReason[] {
  return [...(isLate(option) ? (['late'] as const) : []), ...whyAvoid(option)]
}
