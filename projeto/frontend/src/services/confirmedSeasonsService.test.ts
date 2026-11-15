import { describe, expect, it } from 'vitest'
import type { Historico, HistoricoAno, SituacaoAno } from '../models/talhao'
import {
  applyConfirmations,
  confirmationRows,
  formatConfirmadas,
  noSoyAtPoint,
  parseConfirmadas,
  withConfirmation,
} from './confirmedSeasonsService'

const ano = (year: number, situacao: SituacaoAno): HistoricoAno => ({
  ano: year,
  situacao,
  ndvi_max: situacao === 'plantou' ? 0.74 : situacao === 'parado' ? 0.38 : null,
  n_obs: situacao === 'sem_dado' || situacao === 'sem_soja' ? 0 : 3,
  fonte_ano: 'satelite',
})

/** Histórico de teste de 2017 a 2026, na ordem das situações dadas. */
function historico(situacoes: SituacaoAno[]): Historico {
  const anos = situacoes.map((situacao, index) => ano(2017 + index, situacao))
  const count = (...which: SituacaoAno[]) => anos.filter((a) => which.includes(a.situacao)).length
  return {
    anos,
    parado: count('parado'),
    plantou: count('plantou'),
    sem_certeza: count('incerto', 'sem_dado'),
    sem_soja: count('sem_soja'),
    total: anos.length,
    fonte: 'MODIS MOD13Q1 + MYD13Q1',
    janela: '04-01 a 07-31',
  }
}

const TEN: SituacaoAno[] = [
  'parado',
  'plantou',
  'sem_soja',
  'plantou',
  'parado',
  'incerto',
  'plantou',
  'plantou',
  'parado',
  'sem_dado',
]

describe('parseConfirmadas / formatConfirmadas (o que vai na URL)', () => {
  it('lê "2024:plantou,2026:parado" como ano → resposta', () => {
    expect(parseConfirmadas('2024:plantou,2026:parado')).toEqual({ 2024: 'plantou', 2026: 'parado' })
  })

  it('ignora pedaços fora do formato ou com outra resposta; vazio não tem nada', () => {
    expect(parseConfirmadas('2024:plantou,2025:talvez,xx,2026-parado')).toEqual({ 2024: 'plantou' })
    expect(parseConfirmadas('')).toEqual({})
    expect(parseConfirmadas(null)).toEqual({})
  })

  it('escreve em ordem de ano; sem nenhuma, não escreve nada', () => {
    expect(formatConfirmadas({ 2026: 'parado', 2024: 'plantou' })).toBe('2024:plantou,2026:parado')
    expect(formatConfirmadas({})).toBeUndefined()
  })

  it('marcar troca a resposta do ano; tocar de novo (null) volta para o satélite', () => {
    const one = withConfirmation({}, 2025, 'plantou')
    const two = withConfirmation(one, 2025, 'parado')

    expect(one).toEqual({ 2025: 'plantou' })
    expect(two).toEqual({ 2025: 'parado' })
    expect(withConfirmation(two, 2025, null)).toEqual({})
  })
})

describe('applyConfirmations (a resposta do produtor vale no lugar do satélite)', () => {
  it('troca a situação do ano confirmado, marca a fonte e refaz as contas', () => {
    // 2025 o satélite viu "parado"; o produtor diz que plantou. 2026 sem dado: ele deixou parado.
    const result = applyConfirmations(historico(TEN), { 2025: 'plantou', 2026: 'parado' })

    expect(result?.anos[8]).toEqual({ ...ano(2025, 'plantou'), ndvi_max: 0.38, n_obs: 3, fonte_ano: 'produtor' })
    expect(result?.anos[9]).toMatchObject({ ano: 2026, situacao: 'parado', fonte_ano: 'produtor' })
    // Parado: 2017, 2021 e 2026 (produtor); plantou: 2018, 2020, 2023, 2024 e 2025 (produtor)
    expect(result).toMatchObject({ parado: 3, plantou: 5, sem_certeza: 1, sem_soja: 1, total: 10 })
  })

  it('sem confirmação, devolve o histórico do satélite; sem histórico, nada', () => {
    const satellite = historico(TEN)

    expect(applyConfirmations(satellite, {})).toBe(satellite)
    expect(applyConfirmations(null, { 2025: 'plantou' })).toBeNull()
  })
})

describe('confirmationRows (bloco "Confirme as últimas safras")', () => {
  it('cada ano confirmável com o que o satélite viu e a escolha do produtor', () => {
    const rows = confirmationRows(historico(TEN), [2024, 2025, 2026], { 2026: 'plantou' })

    expect(rows).toEqual([
      { year: 2024, satellite: 'plantou', choice: null },
      { year: 2025, satellite: 'parado', choice: null },
      // Sem dado do satélite: começa vazio e o produtor só responde.
      { year: 2026, satellite: null, choice: 'plantou' },
    ])
  })

  it('"sem soja" e "incerto" aparecem como o que o satélite viu', () => {
    const rows = confirmationRows(historico(['sem_soja', 'incerto']), [2017, 2018], {})

    expect(rows.map((row) => row.satellite)).toEqual(['sem_soja', 'incerto'])
  })

  it('sem histórico do satélite (a maioria dos pontos por enquanto), os anos vêm vazios', () => {
    expect(confirmationRows(null, [2024, 2025, 2026], { 2025: 'parado' })).toEqual([
      { year: 2024, satellite: null, choice: null },
      { year: 2025, satellite: null, choice: 'parado' },
      { year: 2026, satellite: null, choice: null },
    ])
  })

  it('a API que ainda não manda os anos confirmáveis: sem bloco', () => {
    expect(confirmationRows(historico(TEN), undefined, {})).toEqual([])
    expect(confirmationRows(historico(TEN), null, {})).toEqual([])
  })
})

describe('noSoyAtPoint ("Não parece uma lavoura de soja")', () => {
  it('nenhum ano com soja e algum ano "sem soja": não parece lavoura de soja', () => {
    expect(noSoyAtPoint(historico(['sem_soja', 'sem_soja', 'sem_dado']))).toBe(true)
  })

  it('basta um ano com soja (parado, plantou ou incerto) para não avisar', () => {
    expect(noSoyAtPoint(historico(['sem_soja', 'incerto']))).toBe(false)
    expect(noSoyAtPoint(historico(['sem_soja', 'parado']))).toBe(false)
  })

  it('só sem dado, ou sem histórico, não avisa (o satélite não viu)', () => {
    expect(noSoyAtPoint(historico(['sem_dado', 'sem_dado']))).toBe(false)
    expect(noSoyAtPoint(null)).toBe(false)
  })
})
