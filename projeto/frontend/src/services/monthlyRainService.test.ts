import { describe, expect, it } from 'vitest'
import type { ChuvaMensal, Talhao } from '../models/talhao'
import { rainChart } from './monthlyRainService'

const YEARS = Array.from({ length: 20 }, (_, index) => 2005 + index)

/** Valores redondos de teste (não são do NASA POWER). */
const CHUVA: ChuvaMensal = {
  meses: [
    { mes: 1, media_mm: 200 },
    { mes: 2, media_mm: 150 },
    { mes: 3, media_mm: 100 },
    { mes: 4, media_mm: 50 },
    { mes: 5, media_mm: 20 },
    { mes: 6, media_mm: 10 },
  ],
  anos: YEARS,
  fonte: 'nasa_power',
}

function talhao(chuva_mensal?: ChuvaMensal | null): Talhao {
  return {
    ponto: { lat: -18.9543, lon: -48.1993 },
    celula_id: '-190_-482',
    dentro_da_area: true,
    solo: null,
    colheita_sugerida: null,
    historico: null,
    dados: [],
    ...(chuva_mensal === undefined ? {} : { chuva_mensal }),
  }
}

describe('rainChart (gráfico "Chuva de cada mês na região", tela 3)', () => {
  it('uma barra por mês, de janeiro a junho, com a altura em % do mês mais chuvoso', () => {
    expect(rainChart(talhao(CHUVA))).toEqual({
      bars: [
        { month: 'jan', mm: 200, heightPct: 100 },
        { month: 'feb', mm: 150, heightPct: 75 },
        { month: 'mar', mm: 100, heightPct: 50 },
        { month: 'apr', mm: 50, heightPct: 25 },
        { month: 'may', mm: 20, heightPct: 10 },
        { month: 'jun', mm: 10, heightPct: 5 },
      ],
      firstYear: 2005,
      lastYear: 2024,
      years: 20,
      sources: ['nasa_power'],
    })
  })

  it('arredonda os milímetros e a altura para inteiros', () => {
    const chart = rainChart(talhao({ ...CHUVA, meses: [{ mes: 1, media_mm: 212.7 }, { mes: 2, media_mm: 161.0 }] }))

    expect(chart?.bars).toEqual([
      { month: 'jan', mm: 213, heightPct: 100 },
      { month: 'feb', mm: 161, heightPct: 76 },
    ])
  })

  it('põe os meses em ordem e deixa de fora o que não é de janeiro a junho', () => {
    const chart = rainChart(
      talhao({
        ...CHUVA,
        meses: [
          { mes: 7, media_mm: 400 },
          { mes: 2, media_mm: 50 },
          { mes: 1, media_mm: 100 },
        ],
      }),
    )

    expect(chart?.bars.map((bar) => [bar.month, bar.heightPct])).toEqual([
      ['jan', 100],
      ['feb', 50],
    ])
  })

  it('com anos faltando no meio, conta quantos anos entraram', () => {
    const chart = rainChart(talhao({ ...CHUVA, anos: [2010, 2005, 2024] }))

    expect(chart).toMatchObject({ firstYear: 2005, lastYear: 2024, years: 3 })
  })

  it('com mais de uma fonte de chuva, separa as chaves', () => {
    expect(rainChart(talhao({ ...CHUVA, fonte: 'gpm_imerg+nasa_power' }))?.sources).toEqual(['gpm_imerg', 'nasa_power'])
  })

  it('sem chuva em nenhum mês, as barras ficam sem altura', () => {
    const chart = rainChart(talhao({ ...CHUVA, meses: [{ mes: 1, media_mm: 0 }, { mes: 2, media_mm: 0 }] }))

    expect(chart?.bars.map((bar) => bar.heightPct)).toEqual([0, 0])
  })

  it('sem o dado da API, não há gráfico ("Ainda não conectado")', () => {
    expect(rainChart(undefined)).toBeNull()
    expect(rainChart(talhao())).toBeNull() // API que ainda não manda o campo
    expect(rainChart(talhao(null))).toBeNull()
    expect(rainChart(talhao({ ...CHUVA, meses: [] }))).toBeNull()
    expect(rainChart(talhao({ ...CHUVA, anos: [] }))).toBeNull()
    expect(rainChart(talhao({ ...CHUVA, meses: [{ mes: 9, media_mm: 80 }] }))).toBeNull()
  })
})
