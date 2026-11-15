import { describe, expect, it } from 'vitest'
import type { FaixaNdvi } from '../models/raioX'
import type { Historico, SituacaoAno } from '../models/talhao'
import { DEFAULT_COLUMNS, seasonChart } from './seasonChartService'

const COLUMNS = ['01-01', '01-17', '02-02', '02-18', '03-06', '03-22', '04-07', '04-23', '05-09', '05-25', '06-10', '06-26', '07-12', '07-28']

const row = (base: number) => COLUMNS.map((_, index) => (index === 2 ? null : base))

/** NDVI de 2017 a 2026 (10 safras com leitura), a soja secando em 25/fev. */
const strip: FaixaNdvi = {
  colunas: COLUMNS,
  anos: Array.from({ length: 10 }, (_, index) => ({ ano: 2017 + index, valores: row(0.8) })),
  fonte: 'MODIS MOD13Q1 + MYD13Q1',
  colheita_dia: '02-25',
}

function historico(situations: Partial<Record<number, SituacaoAno>>): Historico {
  const anos = Array.from({ length: 10 }, (_, index) => {
    const ano = 2017 + index
    return { ano, situacao: situations[ano] ?? ('plantou' as SituacaoAno), ndvi_max: 0.7, n_obs: 12 }
  })
  return { anos, parado: 0, plantou: 0, sem_certeza: 0, total: 10, fonte: 'MODIS', janela: '04-01 a 07-31' }
}

describe('gráfico das safras do raio-X (tela 4, pacote 2)', () => {
  it('com NDVI: todas as safras com leitura, uma por linha, com o nível de cada leitura', () => {
    const chart = seasonChart({ strip, historico: historico({}), answers: {}, current: undefined })

    expect(chart.readings).toBe(true)
    expect(chart.rows.map((item) => item.year)).toEqual([2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026])
    expect(chart.rows[0].cells).toHaveLength(14)
    expect(chart.rows[0].cells![0]).toEqual({ value: 0.8, level: 5 })
    expect(chart.rows[0].cells![2]).toEqual({ value: null, level: 0 })
    expect(chart.columns).toEqual(COLUMNS)
  })

  it('destaca só as 3 safras que o produtor confirma (2023/24 a 2025/26)', () => {
    const chart = seasonChart({ strip, historico: historico({}), answers: {}, current: undefined })

    expect(chart.rows.filter((item) => item.confirmable).map((item) => item.year)).toEqual([2024, 2025, 2026])
  })

  it('faixas de cima: soja até a colheita (coluna do dia em que a soja seca), colheita e depois da soja', () => {
    const chart = seasonChart({ strip, historico: historico({}), answers: {}, current: undefined })

    expect(chart.marks).toEqual({ soy: [0, 3], harvest: 3, offseason: [4, 14] })
    expect(chart.months[0]).toEqual({ month: 1, from: 0, span: 2 })
    expect(chart.months).toHaveLength(7)
    expect(chart.months.at(-1)).toEqual({ month: 7, from: 12, span: 2 })
  })

  it('sem NDVI: só as 3 últimas safras, sem leitura (listradas), nas colunas de sempre', () => {
    const chart = seasonChart({ strip: null, historico: null, answers: {}, current: undefined, harvestDay: '03-10' })

    expect(chart.readings).toBe(false)
    expect(chart.rows.map((item) => item.year)).toEqual([2024, 2025, 2026])
    expect(chart.rows.every((item) => item.cells === null && item.confirmable)).toBe(true)
    expect(chart.columns).toEqual(DEFAULT_COLUMNS)
    // Sem a leitura da soja secando, a colheita do gráfico é a data do produtor.
    expect(chart.marks.harvest).toBe(4)
  })

  it('sem NDVI e sem data, a colheita fica fora e o depois da soja começa em abril', () => {
    const chart = seasonChart({ strip: null, historico: null, answers: {}, current: undefined })

    expect(chart.marks).toEqual({ soy: [0, 6], harvest: null, offseason: [6, 14] })
  })

  it('a safra confirmável que o NDVI não trouxe entra sem leitura, na ordem', () => {
    const short = { ...strip, anos: strip.anos.filter((item) => item.ano !== 2026) }
    const chart = seasonChart({ strip: short, historico: historico({}), answers: {}, current: undefined })

    expect(chart.rows.map((item) => item.year).slice(-2)).toEqual([2025, 2026])
    expect(chart.rows.at(-1)!.cells).toBeNull()
  })

  it('coluna da direita: a resposta do produtor ou, sem ela, o que o satélite viu', () => {
    const chart = seasonChart({
      strip,
      historico: historico({ 2020: 'parado', 2021: 'incerto', 2025: 'parado' }),
      answers: { 2024: 'milho_braquiaria', 2025: 'soja', 2026: 'pousio' },
      current: undefined,
    })
    const status = (year: number) => chart.rows.find((item) => item.year === year)!.status

    expect(status(2019)).toEqual({ kind: 'satellite', situation: 'plantou' })
    expect(status(2020)).toEqual({ kind: 'satellite', situation: 'parado' })
    expect(status(2021)).toEqual({ kind: 'satellite', situation: 'incerto' })
    expect(status(2024)).toEqual({ kind: 'answer', answer: 'milho_braquiaria' })
    // "Plantei" sem dizer o depois: vale o que o satélite viu depois da soja.
    expect(status(2025)).toEqual({ kind: 'satellite', situation: 'parado' })
    expect(status(2026)).toEqual({ kind: 'answer', answer: 'pousio' })
  })

  it('sem satélite e sem resposta, falta confirmar; "Não plantei" vira a resposta', () => {
    const chart = seasonChart({ strip: null, historico: null, answers: { 2025: 'sem_soja' }, current: undefined })

    expect(chart.rows.map((item) => item.status)).toEqual([
      { kind: 'missing' },
      { kind: 'answer', answer: 'sem_soja' },
      { kind: 'missing' },
    ])
  })

  it('o título conta pelas respostas: parada em p das n safras com soja (a resposta vale no lugar do satélite)', () => {
    const chart = seasonChart({
      strip,
      historico: historico({ 2018: 'parado', 2019: 'sem_soja', 2024: 'parado', 2025: 'parado' }),
      answers: { 2024: 'sorgo', 2026: 'pousio', 2023: 'sem_soja' },
      current: undefined,
    })

    // Parada: 2018 (satélite), 2025 (satélite) e 2026 (resposta). 2024 virou sorgo.
    expect(chart.idle).toBe(3)
    // Sem soja: 2019 (satélite) e 2023 (resposta) ficam de fora.
    expect(chart.total).toBe(8)
  })

  it('a safra atual (2026/27) vem por último, com a escolha do produtor', () => {
    expect(seasonChart({ strip, historico: null, answers: {}, current: 'sorgo' }).current).toEqual({ year: 2027, choice: 'sorgo' })
    expect(seasonChart({ strip, historico: null, answers: {}, current: undefined }).current).toEqual({ year: 2027, choice: null })
  })
})
