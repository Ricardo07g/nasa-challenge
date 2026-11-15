import { describe, expect, it } from 'vitest'
import type { Opcao, Recomendacao } from '../models/recomendacao'
import * as rules from './recomendacaoRules'
import {
  alternativeSummary,
  buildAnswer,
  buildPlan,
  initialScenario,
  plantingRule,
  findOption,
  futureSummary,
  optionsSummary,
  harvestYear,
  planSummary,
  planSwaps,
  scoreRows,
  sortOptions,
} from './recomendacaoRules'

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

describe('alternativeSummary', () => {
  it('cada motivo destaca o que importa', () => {
    const sorgo = options[0]
    expect(alternativeSummary('menos_risco', sorgo)).toEqual(['chuva sorgo', 'renda sorgo'])
    expect(alternativeSummary('mais_renda', sorgo)).toEqual(['renda sorgo', 'risco sorgo'])
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
        { motivo: 'mais_renda', opcao: 'milheto' },
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
      { motivo: 'menos_risco', option: options[0], text: 'chuva sorgo. renda sorgo.' },
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

  it('traz o clima de 2041–2060 da melhor opção, para a linha do futuro no cartão', () => {
    const best = { ...options[1], futuro: { anos_bons_media: 14, anos_bons_min: 13, anos_bons_max: 15, modelos: 3, cenario: 'ssp245' } }

    expect(buildAnswer(recomendacao({ opcoes: [options[0], best] }))?.future).toEqual({
      good: 14,
      total: 20,
      range: { min: 13, max: 15 },
    })
  })

  it('sem o CMIP6 na API, a linha do futuro fica sem dado (null)', () => {
    expect(buildAnswer(recomendacao())?.future).toBeNull()
  })
})

describe('futureSummary (clima de 2041–2060, NEX-GDDP-CMIP6)', () => {
  const futuro = (media: number, min: number, max: number) => ({
    anos_bons_media: media,
    anos_bons_min: min,
    anos_bons_max: max,
    modelos: 3,
    cenario: 'ssp245',
  })

  it('anos bons pela média dos modelos, com a faixa entre os modelos', () => {
    expect(futureSummary({ ...options[1], futuro: futuro(14, 13, 15) })).toEqual({
      good: 14,
      total: 20,
      range: { min: 13, max: 15 },
    })
  })

  it('o total de anos é o mesmo da chuva de hoje (chuva.anos)', () => {
    const option = { ...options[1], chuva: { ...options[1].chuva, anos: 18 }, futuro: futuro(12, 10, 13) }

    expect(futureSummary(option)?.total).toBe(18)
  })

  it('quando todos os modelos dão o mesmo número, não há faixa', () => {
    expect(futureSummary({ ...options[1], futuro: futuro(19, 19, 19) })).toEqual({ good: 19, total: 20, range: null })
  })

  it('sem o dado do CMIP6, devolve null', () => {
    expect(futureSummary(options[1])).toBeNull()
  })
})

describe('optionsSummary (tela 6)', () => {
  const late = { ...opcao('milho_safrinha', 14, 70, 10, 58), na_janela: false }
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
    expect(optionsSummary(rec, 'renda').options.map((o) => o.id)).toEqual([
      'sorgo',
      'milho_braquiaria',
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

describe('sem "Comece por um pedaço" (tarefa 0040: nenhum valor em reais)', () => {
  it('não há mais conta de hectares nem totais em reais', () => {
    expect('normalizeHectares' in rules).toBe(false)
    expect('testAreaTotals' in rules).toBe(false)
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
