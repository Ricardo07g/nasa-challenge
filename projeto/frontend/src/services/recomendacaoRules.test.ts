import { describe, expect, it } from 'vitest'
import type { Opcao, Recomendacao } from '../models/recomendacao'
import {
  alternativeSummary,
  buildAnswer,
  buildPlan,
  findOption,
  optionsSummary,
  harvestYear,
  planSummary,
  planSwaps,
  scoreRows,
  sortOptions,
} from './recomendacaoRules'

function opcao(id: Opcao['id'], anosBons: number, margem: number, terra: number, final: number): Opcao {
  return {
    id,
    nome: id,
    na_janela: true,
    chuva: { anos_bons: anosBons, anos: 20, faixa: [], rotulo: 'bom', texto: `chuva ${id}` },
    data_limite: null,
    futuro: null,
    dinheiro: { margem_ha: margem, rotulo: 'bom', texto: `dinheiro ${id}` },
    terra: { nota: terra, rotulo: 'bom', texto: `terra ${id}` },
    notas: { seguranca: 0, futuro: 0, solo: 0, renda: 0, final },
    porque: [],
    como_fazer: [],
  }
}

const options = [
  opcao('sorgo', 17, 540, 30, 62),
  opcao('milho_braquiaria', 14, 700, 50, 66),
  opcao('milho_safrinha', 14, 950, 10, 58),
  opcao('crotalaria', 17, -250, 80, 55),
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

  it('por dinheiro e por terra', () => {
    expect(sortOptions(options, 'dinheiro')[0].id).toBe('milho_safrinha')
    expect(sortOptions(options, 'terra')[0].id).toBe('crotalaria')
  })

  it('não altera a lista original', () => {
    const copy = [...options]
    sortOptions(options, 'terra')
    expect(options).toEqual(copy)
  })
})

describe('alternativeSummary', () => {
  it('cada motivo destaca o que importa', () => {
    const sorgo = options[0]
    expect(alternativeSummary('menos_risco', sorgo)).toEqual(['chuva sorgo', 'dinheiro sorgo'])
    expect(alternativeSummary('mais_dinheiro', sorgo)).toEqual(['dinheiro sorgo', 'terra sorgo'])
    expect(alternativeSummary('cuidar_da_terra', sorgo)).toEqual(['terra sorgo'])
  })
})

describe('findOption', () => {
  it('acha a opção pelo id', () => {
    expect(findOption(options, 'crotalaria')?.id).toBe('crotalaria')
    expect(findOption(options, 'milheto')).toBeUndefined()
  })
})

describe('harvestYear', () => {
  it('é o ano da semeadura', () => {
    expect(harvestYear('2027-02-18')).toBe(2027)
  })
})

describe('planSummary', () => {
  it('conta anos com grão e com terra coberta', () => {
    expect(planSummary(['milho_braquiaria', 'crotalaria', 'sorgo'])).toEqual({ grain: 2, covered: 3, total: 3 })
    expect(planSummary(['pousio', 'crotalaria', 'pousio'])).toEqual({ grain: 0, covered: 1, total: 3 })
  })
})

describe('planSwaps', () => {
  it('lista o que muda do ano normal para o ano seco', () => {
    expect(planSwaps(['milho_braquiaria', 'crotalaria', 'sorgo'], ['sorgo', 'crotalaria', 'sorgo'], 2027)).toEqual([
      { year: 2027, from: 'milho_braquiaria', to: 'sorgo' },
    ])
  })
})

describe('buildAnswer (tela 5)', () => {
  const recomendacao = (overrides: Partial<Recomendacao> = {}) =>
    ({
      entrada: { celula_id: null, colheita: 'meio', semeadura: '2027-02-18', solo: 'medio', nematoide: null },
      melhor: 'milho_braquiaria',
      alternativas: [
        { motivo: 'menos_risco', opcao: 'sorgo' },
        { motivo: 'cuidar_da_terra', opcao: 'crotalaria' },
        { motivo: 'mais_dinheiro', opcao: 'milheto' },
      ],
      opcoes: options,
      fora_da_janela: [],
      ...overrides,
    }) as Recomendacao

  it('traz a melhor opção e o ano da soja', () => {
    const answer = buildAnswer(recomendacao())

    expect(answer?.best.id).toBe('milho_braquiaria')
    expect(answer?.year).toBe(2027)
  })

  it('cada alternativa vem com a frase do seu motivo; opção que não existe é ignorada', () => {
    expect(buildAnswer(recomendacao())?.alternatives).toEqual([
      { motivo: 'menos_risco', option: options[0], text: 'chuva sorgo. dinheiro sorgo.' },
      { motivo: 'cuidar_da_terra', option: options[3], text: 'terra crotalaria.' },
    ])
  })

  it('junta os nomes e os textos do que ficou fora da janela de plantio', () => {
    const answer = buildAnswer(
      recomendacao({
        fora_da_janela: [{ id: 'milho_safrinha', nome: 'Milho sozinho', texto: 'Passa da data do ZARC.' }],
      }),
    )

    expect(answer?.late).toEqual({ names: ['Milho sozinho'], texts: ['Passa da data do ZARC.'] })
  })

  it('sem a melhor opção na lista, não há resposta para mostrar', () => {
    expect(buildAnswer(recomendacao({ melhor: 'pousio' }))).toBeNull()
  })
})

describe('optionsSummary (tela 6)', () => {
  const late = { ...opcao('milho_safrinha', 14, 950, 10, 58), na_janela: false }
  const rec = {
    opcoes: [options[0], options[1], late, options[3]],
    fora_da_janela: [{ id: 'milho_safrinha', nome: 'Milho sozinho', texto: 'Passa da data do ZARC.' }],
  } as Recomendacao

  it('sem eixo, ordena pela nota final; quem está fora da janela vai para o fim', () => {
    expect(optionsSummary(rec, null).options.map((o) => o.id)).toEqual([
      'milho_braquiaria',
      'sorgo',
      'crotalaria',
      'milho_safrinha',
    ])
  })

  it('com um eixo, coloca na frente quem é melhor nele', () => {
    expect(optionsSummary(rec, 'dinheiro').options.map((o) => o.id)).toEqual([
      'milho_braquiaria',
      'sorgo',
      'crotalaria',
      'milho_safrinha',
    ])
    expect(optionsSummary(rec, 'terra').options[0].id).toBe('crotalaria')
  })

  it('traz o aviso do que ficou fora da janela de plantio', () => {
    expect(optionsSummary(rec, null).late).toEqual({ names: ['Milho sozinho'], texts: ['Passa da data do ZARC.'] })
  })
})

describe('buildPlan (tela 7)', () => {
  const rec = {
    entrada: { celula_id: null, colheita: 'meio', semeadura: '2027-02-18', solo: 'medio', nematoide: null },
    plano_3_anos: {
      normal: { anos: ['milho_braquiaria', 'crotalaria', 'sorgo'], nota: 66 },
      seco: { anos: ['sorgo', 'crotalaria', 'sorgo'], nota: 58 },
      hoje: { descricao: 'Terra descoberta em metade dos anos', nota: 48 },
    },
  } as Recomendacao

  it('ano normal: um ano por bloco, a partir da soja de 2027, sem trocas', () => {
    expect(buildPlan(rec, 'normal')).toEqual({
      years: [
        { year: 2027, crop: 'milho_braquiaria', swappedFrom: null },
        { year: 2028, crop: 'crotalaria', swappedFrom: null },
        { year: 2029, crop: 'sorgo', swappedFrom: null },
      ],
      summary: { grain: 2, covered: 3, total: 3 },
      swaps: [],
      today: 'Terra descoberta em metade dos anos',
    })
  })

  it('ano seco: mostra o que troca e de onde veio', () => {
    const plan = buildPlan(rec, 'seco')

    expect(plan.years[0]).toEqual({ year: 2027, crop: 'sorgo', swappedFrom: 'milho_braquiaria' })
    expect(plan.years[1].swappedFrom).toBeNull()
    expect(plan.swaps).toEqual([{ year: 2027, from: 'milho_braquiaria', to: 'sorgo' }])
    expect(plan.summary).toEqual({ grain: 2, covered: 3, total: 3 })
  })
})

describe('scoreRows (tela 9)', () => {
  it('as notas de 0 a 100 de cada opção, da maior nota final para a menor', () => {
    const rows = scoreRows({ opcoes: options } as Recomendacao)

    expect(rows.map((row) => row.id)).toEqual(['milho_braquiaria', 'sorgo', 'milho_safrinha', 'crotalaria'])
    expect(rows[0]).toEqual({ id: 'milho_braquiaria', nome: 'milho_braquiaria', notas: options[1].notas })
  })
})
