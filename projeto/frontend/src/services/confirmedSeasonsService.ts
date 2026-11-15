import { CONFIRMACOES, type Confirmacao, type Confirmadas, type Historico, type SituacaoAno } from '../models/talhao'

/**
 * Safras confirmadas pelo produtor na tela 4 (tarefa 0039 do backend): nas últimas entressafras, ele
 * diz "Plantei" ou "Deixei parado", e a resposta vale no lugar do satélite naquele ano. A escolha fica
 * na URL (`confirmadas=2024:plantou,2025:parado`) e vai para o `/recomendacao`, que confere os anos.
 */

const PAIR = /^(\d{4}):([a-z_]+)$/

/** `"2024:plantou,2025:parado"` → `{ 2024: 'plantou', 2025: 'parado' }`; pedaço fora do formato fica de fora. */
export function parseConfirmadas(text: string | null | undefined): Confirmadas {
  const result: Partial<Record<number, Confirmacao>> = {}
  for (const piece of (text ?? '').split(',')) {
    const match = PAIR.exec(piece.trim())
    if (match && CONFIRMACOES.includes(match[2] as Confirmacao)) result[Number(match[1])] = match[2] as Confirmacao
  }
  return result
}

function entries(confirmadas: Confirmadas): [number, Confirmacao][] {
  return Object.entries(confirmadas)
    .filter((entry): entry is [string, Confirmacao] => entry[1] !== undefined)
    .map(([year, value]): [number, Confirmacao] => [Number(year), value])
    .sort((a, b) => a[0] - b[0])
}

/** O formato da URL, em ordem de ano; sem nenhuma confirmação, `undefined` (o parâmetro some). */
export function formatConfirmadas(confirmadas: Confirmadas): string | undefined {
  const list = entries(confirmadas)
  return list.length ? list.map(([year, value]) => `${year}:${value}`).join(',') : undefined
}

/** Marca a resposta do ano; `null` (tocar de novo na resposta marcada) volta para o satélite. */
export function withConfirmation(confirmadas: Confirmadas, year: number, value: Confirmacao | null): Confirmadas {
  const next: Partial<Record<number, Confirmacao>> = { ...confirmadas }
  if (value === null) delete next[year]
  else next[year] = value
  return next
}

/**
 * O histórico com as respostas do produtor no lugar do satélite (`fonte_ano: 'produtor'`) e as contas
 * refeitas, a mesma regra do backend. Sem confirmação, o próprio histórico; sem histórico, null (o
 * cartão do histórico não aparece e o bloco de confirmação continua, decisão D2).
 */
export function applyConfirmations(historico: Historico | null, confirmadas: Confirmadas): Historico | null {
  if (!historico || entries(confirmadas).length === 0) return historico
  const anos = historico.anos.map((ano) => {
    const answer = confirmadas[ano.ano]
    return answer ? { ...ano, situacao: answer, fonte_ano: 'produtor' as const } : ano
  })
  const count = (...which: SituacaoAno[]) => anos.filter((ano) => which.includes(ano.situacao)).length
  return {
    ...historico,
    anos,
    parado: count('parado'),
    plantou: count('plantou'),
    sem_certeza: count('incerto', 'sem_dado'),
    sem_soja: count('sem_soja'),
  }
}

/** O que o satélite viu num ano, para mostrar ao lado da pergunta (sem dado = nada). */
export type SatelliteSeen = Exclude<SituacaoAno, 'sem_dado'>

export type ConfirmRow = { year: number; satellite: SatelliteSeen | null; choice: Confirmacao | null }

/**
 * Uma linha por ano confirmável (`anos_confirmaveis` do talhão), com o que o satélite viu e a escolha
 * do produtor. Sem a lista (API antiga), nenhuma linha: o bloco não aparece.
 */
export function confirmationRows(
  historico: Historico | null,
  anosConfirmaveis: readonly number[] | null | undefined,
  confirmadas: Confirmadas,
): ConfirmRow[] {
  return (anosConfirmaveis ?? []).map((year) => {
    const situacao = historico?.anos.find((ano) => ano.ano === year)?.situacao
    return {
      year,
      satellite: situacao && situacao !== 'sem_dado' ? situacao : null,
      choice: confirmadas[year] ?? null,
    }
  })
}

/**
 * "Não parece uma lavoura de soja": o satélite viu algum ano sem soja e nenhum com soja (parado,
 * plantou ou incerto). Só sem dado, ou sem histórico, não avisa. Olha o que o satélite viu, antes das
 * confirmações: o aviso é sobre o ponto marcado.
 */
export function noSoyAtPoint(historico: Historico | null): boolean {
  if (!historico) return false
  const situacoes = historico.anos.map((ano) => ano.situacao)
  const withSoy = situacoes.some((situacao) => situacao === 'parado' || situacao === 'plantou' || situacao === 'incerto')
  return !withSoy && situacoes.includes('sem_soja')
}
