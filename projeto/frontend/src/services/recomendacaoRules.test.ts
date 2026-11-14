import { describe, expect, it } from 'vitest'
import type { Opcao, Recomendacao } from '../models/recomendacao'
import {
  alternativeSummary,
  buildAnswer,
  findOption,
  harvestYear,
  planSummary,
  planSwaps,
  sortOptions,
} from './recomendacaoRules'

function opcao(id: Opcao['id'], anosBons: number, margem: number, terra: number, final: number): Opcao {
  return {
    id,
    nome: id,
    na_janela: true,
    chuva: { anos_bons: anosBons, anos: 20, faixa: [], rotulo: 'bom', texto: `chuva ${id}` },
    futuro: { anos_bons_media: 0, anos_bons_min: 0, anos_bons_max: 0 },
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
