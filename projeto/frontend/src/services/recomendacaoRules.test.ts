import { describe, expect, it } from 'vitest'
import type { Opcao, Recomendacao } from '../models/recomendacao'
import {
  alternativeSummary,
  buildAnswer,
  buildPlan,
  initialScenario,
  normalizeHectares,
  plantingRule,
  testAreaTotals,
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
      seco: { anos: ['sorgo', 'crotalaria', 'sorgo'], nota: 58, descricao: 'Testada nos 4 anos mais secos da série (2007, 2010, 2012, 2014).' },
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
      dryNote: null,
    })
  })

  it('ano seco: mostra o que troca e de onde veio', () => {
    const plan = buildPlan(rec, 'seco')

    expect(plan.years[0]).toEqual({ year: 2027, crop: 'sorgo', swappedFrom: 'milho_braquiaria' })
    expect(plan.years[1].swappedFrom).toBeNull()
    expect(plan.swaps).toEqual([{ year: 2027, from: 'milho_braquiaria', to: 'sorgo' }])
    expect(plan.summary).toEqual({ grain: 2, covered: 3, total: 3 })
  })

  it('no ano seco, como o plano B foi testado vem da API (nada de "últimos 20" fixo)', () => {
    expect(buildPlan(rec, 'seco').dryNote).toBe('Testada nos 4 anos mais secos da série (2007, 2010, 2012, 2014).')
  })
})

describe('scoreRows (tela 9)', () => {
  it('as notas de 0 a 100 de cada opção, da maior nota final para a menor', () => {
    const rows = scoreRows({ opcoes: options } as Recomendacao)

    expect(rows.map((row) => row.id)).toEqual(['milho_braquiaria', 'sorgo', 'milho_safrinha', 'crotalaria'])
    expect(rows[0]).toEqual({ id: 'milho_braquiaria', nome: 'milho_braquiaria', notas: options[1].notas })
  })
})

describe('initialScenario (RF-20)', () => {
  it('sinal de ano seco já marca o Plano B; normal, incerto ou sem sinal marcam o Plano A', () => {
    expect(initialScenario({ nivel: 'seco' } as Recomendacao['sinal'])).toBe('seco')
    expect(initialScenario({ nivel: 'incerto' } as Recomendacao['sinal'])).toBe('normal')
    expect(initialScenario(undefined)).toBe('normal')
  })
})

describe('normalizeHectares (RF-21)', () => {
  it('padrão de 50 ha para valor vazio, zero ou inválido; sempre inteiro e no mínimo 1', () => {
    expect(normalizeHectares('')).toBe(50)
    expect(normalizeHectares('0')).toBe(50)
    expect(normalizeHectares('abc')).toBe(50)
    expect(normalizeHectares('12.7')).toBe(12)
    expect(normalizeHectares(120)).toBe(120)
  })
})

describe('testAreaTotals (RF-21, PRD §7.11)', () => {
  const option = (extra: Partial<Opcao['dinheiro']> = {}, seed?: number) =>
    ({ ...options[1], custo_semente_ha: seed, dinheiro: { ...options[1].dinheiro, ...extra } }) as Opcao

  it('quanto sobra, a semente e o pior ano seco, multiplicados pelos hectares', () => {
    expect(testAreaTotals(option({ pior_ano_seco_ha: -180 }, 260), 50)).toEqual({
      margin: 700 * 50,
      seed: 260 * 50,
      worstDry: -180 * 50,
    })
  })

  it('sem o custo da semente ou o pior ano na API, esses totais ficam de fora', () => {
    expect(testAreaTotals(option(), 10)).toEqual({ margin: 7000, seed: null, worstDry: null })
    expect(testAreaTotals(undefined, 10)).toEqual({ margin: null, seed: null, worstDry: null })
  })
})

describe('plantingRule (RF-20)', () => {
  const rec = (sinal?: Recomendacao['sinal']) =>
    ({
      opcoes: [{ ...options[1], data_limite: '2027-02-28' }, options[0]],
      plano_3_anos: {
        normal: { anos: ['milho_braquiaria', 'crotalaria', 'sorgo'] },
        seco: { anos: ['sorgo', 'crotalaria', 'sorgo'] },
      },
      sinal,
    }) as unknown as Recomendacao

  it('com o texto da API, usa ele', () => {
    const sinal = { regra_dia_plantar: { data_limite: '2027-02-28', texto: 'Regra da API.' } } as Recomendacao['sinal']

    expect(plantingRule(rec(sinal))).toEqual({ text: 'Regra da API.' })
  })

  it('sem o sinal, monta a regra com a data limite do 1º ano do Plano A e a troca do Plano B', () => {
    expect(plantingRule(rec())).toEqual({ date: '2027-02-28', planA: 'milho_braquiaria', planB: 'sorgo' })
  })

  it('se o Plano B começa igual ao A, não há troca no dia de plantar (nada de "milho no lugar de milho")', () => {
    const same = {
      ...rec(),
      opcoes: [{ ...options[0], id: 'milho_safrinha', data_limite: '2027-02-28' }],
      plano_3_anos: {
        normal: { anos: ['milho_safrinha', 'crotalaria', 'milheto'] },
        seco: { anos: ['milho_safrinha', 'crotalaria', 'milheto'] },
      },
    } as unknown as Recomendacao

    expect(plantingRule(same)).toBeNull()
  })
})
