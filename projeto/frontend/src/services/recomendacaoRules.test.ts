import { describe, expect, it } from 'vitest'
import type { Opcao, Recomendacao } from '../models/recomendacao'
import * as rules from './recomendacaoRules'
import { findOption, scoreRows, sortOptions } from './recomendacaoRules'

/** `renda` é a nota de renda do motor (tarefa 0040 do backend): sem preço nem custo. */
function opcao(id: Opcao['id'], anosBons: number, renda: number, terra: number, final: number): Opcao {
  return {
    id,
    nome: id,
    na_janela: true,
    chuva: { anos_bons: anosBons, anos: 20, faixa: [], rotulo: 'bom', texto: `chuva ${id}` },
    data_limite: null,
    futuro: null,
    renda: {
      da_grao: renda > 0,
      anos_aperto: 20 - anosBons,
      rotulo: 'bom',
      texto: `renda ${id}`,
      risco: `risco ${id}`,
    },
    terra: { nota: terra, rotulo: 'bom', texto: `terra ${id}` },
    notas: { seguranca: 0, futuro: 0, solo: 0, renda, final },
    porque: [],
    como_fazer: [],
  }
}

const options = [
  opcao('sorgo', 17, 85, 30, 62),
  opcao('milho_braquiaria', 14, 70, 50, 66),
  opcao('milho_safrinha', 14, 70, 10, 58),
  opcao('crotalaria', 17, 0, 80, 55),
]

describe('sortOptions', () => {
  it('sem eixo, ordena pela nota final', () => {
    expect(sortOptions(options, null).map((o) => o.id)).toEqual([
      'milho_braquiaria',
      'sorgo',
      'milho_safrinha',
      'crotalaria',
    ])
  })

  it('por chuva, desempata pela nota final', () => {
    expect(sortOptions(options, 'chuva').map((o) => o.id)).toEqual([
      'sorgo',
      'crotalaria',
      'milho_braquiaria',
      'milho_safrinha',
    ])
  })

  it('por renda, pela nota de renda do motor (sem reais), desempatando pela nota final', () => {
    expect(sortOptions(options, 'renda').map((o) => o.id)).toEqual([
      'sorgo',
      'milho_braquiaria',
      'milho_safrinha',
      'crotalaria',
    ])
  })

  it('por terra', () => {
    expect(sortOptions(options, 'terra')[0].id).toBe('crotalaria')
  })

  it('não altera a lista original', () => {
    const copy = [...options]
    sortOptions(options, 'terra')
    expect(options).toEqual(copy)
  })
})

describe('findOption', () => {
  it('acha a opção pelo id', () => {
    expect(findOption(options, 'crotalaria')?.id).toBe('crotalaria')
    expect(findOption(options, 'milheto')).toBeUndefined()
  })
})

describe('scoreRows (tela 9)', () => {
  it('as notas de 0 a 100 de cada opção, da maior nota final para a menor', () => {
    const rows = scoreRows({ opcoes: options } as Recomendacao)

    expect(rows.map((row) => row.id)).toEqual(['milho_braquiaria', 'sorgo', 'milho_safrinha', 'crotalaria'])
    expect(rows[0]).toEqual({ id: 'milho_braquiaria', nome: 'milho_braquiaria', notas: options[1].notas })
  })

  it('deixa de fora as culturas fora do prazo (o /recomendacao passou a trazer, tarefa 0056)', () => {
    const fora = { ...options[0], id: 'milheto' as const, nome: 'milheto', na_janela: false }
    const rows = scoreRows({ opcoes: [...options, fora] } as Recomendacao)

    expect(rows.map((row) => row.id)).not.toContain('milheto')
    expect(rows).toHaveLength(4)
  })
})

describe('sem "Comece por um pedaço" (tarefa 0040: nenhum valor em reais)', () => {
  it('não há mais conta de hectares nem totais em reais', () => {
    expect('normalizeHectares' in rules).toBe(false)
    expect('testAreaTotals' in rules).toBe(false)
  })
})

describe('sem as regras das telas antigas (tarefa 0049)', () => {
  it('não há mais o plano A/B antigo, a regra da data nem as telas 5 e 6 de antes', () => {
    for (const name of ['buildPlan', 'planSwaps', 'planSummary', 'initialScenario', 'plantingRule', 'optionsSummary', 'buildAnswer']) {
      expect(name in rules).toBe(false)
    }
  })
})
