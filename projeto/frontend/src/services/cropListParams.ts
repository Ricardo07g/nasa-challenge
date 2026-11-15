import type { CropId } from '../models/recomendacao'

/**
 * Listas de culturas guardadas na URL (tarefa 0045): as culturas comparadas (`comparar`), o plano editado
 * (`plano`) e o que o produtor contou das últimas safras (`hoje`). Ficam na URL para o "Voltar" e o
 * compartilhar funcionarem; o link continua legível (só letras, "_", ":" e ",").
 */

/** As culturas do `culturas.yaml` (ids da ADR-0001), com o pousio ("Deixar parado"). */
export const CROP_IDS: readonly CropId[] = ['milho_braquiaria', 'milho_safrinha', 'sorgo', 'milheto', 'crotalaria', 'pousio']

/** Até 3 culturas no Comparar. */
export const MAX_COMPARED = 3

/** Os 3 anos do plano (PRD 7.7). */
export const PLAN_YEARS = 3

const isCrop = (value: string): value is CropId => (CROP_IDS as readonly string[]).includes(value)

/** Uma cultura só (`escolha`, `ano2`, `ano3` da tela 5); fora da lista, `undefined`. */
export function parseCrop(text: string | null | undefined): CropId | undefined {
  return text && isCrop(text) ? text : undefined
}

/** `comparar`: até 3 culturas conhecidas, sem repetir (tela 5: o "Deixar parado" também); nenhuma = `undefined`. */
export function parseCompared(text: string | null | undefined): CropId[] | undefined {
  const crops = [...new Set((text ?? '').split(',').map((piece) => piece.trim()))].filter(isCrop)
  return crops.length ? crops.slice(0, MAX_COMPARED) : undefined
}

/** `plano`: exatamente 3 culturas conhecidas (o pousio vale); fora disso, `undefined` (vale o sugerido). */
export function parsePlan(text: string | null | undefined): CropId[] | undefined {
  const crops = (text ?? '').split(',').map((piece) => piece.trim())
  return crops.length === PLAN_YEARS && crops.every(isCrop) ? crops : undefined
}

export type TodayAnswers = Readonly<Partial<Record<number, CropId>>>

const PAIR = /^(\d{4}):([a-z_]+)$/

/** `hoje`: `"2024:pousio,2026:sorgo"` → `{ 2024: 'pousio', 2026: 'sorgo' }`; pedaço fora do formato fica de fora. */
export function parseToday(text: string | null | undefined): TodayAnswers {
  const result: Partial<Record<number, CropId>> = {}
  for (const piece of (text ?? '').split(',')) {
    const match = PAIR.exec(piece.trim())
    if (match && isCrop(match[2])) result[Number(match[1])] = match[2]
  }
  return result
}

/** O formato da URL, em ordem de ano; sem nenhuma resposta, `undefined` (o parâmetro some). */
export function formatToday(answers: TodayAnswers): string | undefined {
  const list = Object.entries(answers)
    .filter((entry): entry is [string, CropId] => entry[1] !== undefined)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
  return list.length ? list.map(([year, crop]) => `${year}:${crop}`).join(',') : undefined
}
