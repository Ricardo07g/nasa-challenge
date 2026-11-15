import { describe, expect, it } from 'vitest'
import type { ChuvaQueSobra, FimDasChuvas, Talhao } from '../models/talhao'
import { rainEnd, rainLeft } from './rainLeftService'

const YEARS = Array.from({ length: 20 }, (_, index) => 2005 + index)

/** Valores redondos de teste (não são do GPM IMERG). */
const SOBRA: ChuvaQueSobra = {
  fim: '06-30',
  percentil_seco: 20,
  dias: [
    { dia: '02-27', mediana_mm: 400.4, seco_mm: 300.6 },
    { dia: '02-28', mediana_mm: 380, seco_mm: 290 },
    { dia: '03-01', mediana_mm: 360, seco_mm: 250 },
  ],
  anos: YEARS,
  fonte: 'gpm_imerg',
}

const FIM: FimDasChuvas = {
  mediana: '04-21',
  mais_cedo: { dia: '03-16', ano: 2021 },
  mais_tarde: { dia: '06-22', ano: 2012 },
  anos: YEARS,
  fonte: 'gpm_imerg',
  inicio: '03-01',
  dias: 20,
  chuva_max_mm: 10,
}

function talhao(extra: Partial<Talhao> = {}): Talhao {
  return {
    ponto: { lat: -18.9543, lon: -48.1993 },
    celula_id: '-190_-482',
    dentro_da_area: true,
    solo: null,
    colheita_sugerida: null,
    historico: null,
    dados: [],
    ...extra,
  }
}

describe('rainLeft ("Chuva que sobra depois da colheita", tela 3)', () => {
  it('a mediana e o ano seco do dia escolhido, arredondados, com a fonte e o período', () => {
    expect(rainLeft(talhao({ chuva_que_sobra: SOBRA }), '2027-02-27')).toEqual({
      date: '2027-02-27',
      medianMm: 400,
      dryMm: 301,
      endDay: '06-30',
      percentile: 20,
      firstYear: 2005,
      lastYear: 2024,
      years: 20,
      sources: ['gpm_imerg'],
      points: [
        { day: '02-27', median: 400.4, dry: 300.6 },
        { day: '02-28', median: 380, dry: 290 },
        { day: '03-01', median: 360, dry: 250 },
      ],
      maxMm: 400.4,
      selectedIndex: 0,
    })
  })

  it('29 de fevereiro usa o dia 28 (a tabela da API é de um ano comum)', () => {
    const left = rainLeft(talhao({ chuva_que_sobra: SOBRA }), '2028-02-29')

    expect(left?.medianMm).toBe(380)
    expect(left?.selectedIndex).toBe(1)
  })

  it('separa as fontes juntas por "+"', () => {
    const left = rainLeft(talhao({ chuva_que_sobra: { ...SOBRA, fonte: 'gpm_imerg+nasa_power' } }), '2027-03-01')

    expect(left?.sources).toEqual(['gpm_imerg', 'nasa_power'])
  })

  it('sem o campo, sem anos ou com um dia fora da tabela, nada aparece (decisão D2)', () => {
    expect(rainLeft(talhao(), '2027-02-27')).toBeNull()
    expect(rainLeft(talhao({ chuva_que_sobra: null }), '2027-02-27')).toBeNull()
    expect(rainLeft(talhao({ chuva_que_sobra: { ...SOBRA, anos: [] } }), '2027-02-27')).toBeNull()
    expect(rainLeft(talhao({ chuva_que_sobra: SOBRA }), '2027-04-10')).toBeNull()
    expect(rainLeft(talhao({ chuva_que_sobra: SOBRA }), '')).toBeNull()
    expect(rainLeft(undefined, '2027-02-27')).toBeNull()
  })
})

describe('rainEnd (fim das chuvas na célula, tela 3)', () => {
  it('a mediana, o mais cedo e o mais tarde, prontos para escrever a data, com a regra', () => {
    expect(rainEnd(talhao({ fim_das_chuvas: FIM }))).toEqual({
      median: '2023-04-21',
      earliest: { date: '2021-03-16', year: 2021 },
      latest: { date: '2012-06-22', year: 2012 },
      firstYear: 2005,
      lastYear: 2024,
      years: 20,
      sources: ['gpm_imerg'],
      startDate: '2023-03-01',
      days: 20,
      maxMm: 10,
    })
  })

  it('sem o campo ou sem anos, nada aparece', () => {
    expect(rainEnd(talhao())).toBeNull()
    expect(rainEnd(talhao({ fim_das_chuvas: null }))).toBeNull()
    expect(rainEnd(talhao({ fim_das_chuvas: { ...FIM, anos: [] } }))).toBeNull()
    expect(rainEnd(undefined)).toBeNull()
  })
})
