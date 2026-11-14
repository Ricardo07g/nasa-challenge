import { describe, expect, it } from 'vitest'
import type { Talhao } from '../models/talhao'
import { historySummary, rainPeriod, soilSummary } from './satelliteService'

type Historico = NonNullable<Talhao['historico']>
type Ano = Historico['anos'][number]

const ano = (year: number, situacao: Ano['situacao']): Ano => ({
  ano: year,
  situacao,
  ndvi_max: situacao === 'sem_dado' ? null : situacao === 'plantou' ? 0.74 : situacao === 'parado' ? 0.38 : 0.52,
  n_obs: situacao === 'sem_dado' ? 1 : 12,
})

function historico(situacoes: Ano['situacao'][], extra: Partial<Historico> = {}): Historico {
  const anos = situacoes.map((situacao, index) => ano(2016 + index, situacao))
  return {
    anos,
    parado: anos.filter((a) => a.situacao === 'parado').length,
    plantou: anos.filter((a) => a.situacao === 'plantou').length,
    sem_certeza: anos.filter((a) => a.situacao === 'incerto' || a.situacao === 'sem_dado').length,
    total: anos.length,
    fonte: 'MODIS MOD13Q1 + MYD13Q1',
    janela: '04-01 a 07-31',
    ...extra,
  }
}

describe('historySummary', () => {
  it('conta os anos parados, plantados e sem certeza, e mantém a situação de cada ano', () => {
    const summary = historySummary(historico(['parado', 'plantou', 'incerto']))

    expect(summary).toEqual({
      idle: 1,
      planted: 1,
      uncertain: 1,
      known: 2,
      total: 3,
      situations: ['parado', 'plantou', 'incerto'],
      years: ['2016', '2017', '2018'],
      window: { from: 4, to: 7 },
    })
  })

  it('a frase conta só os anos certos: 5 parados, 4 plantados e 1 incerto = 5 de 9 (1 sem certeza)', () => {
    const summary = historySummary(
      historico(['parado', 'plantou', 'parado', 'plantou', 'parado', 'plantou', 'plantou', 'parado', 'incerto', 'parado']),
    )

    expect(summary).toMatchObject({ idle: 5, planted: 4, uncertain: 1, known: 9, total: 10 })
  })

  it('"sem_dado" (pouca imagem sem nuvem) também é ano sem certeza', () => {
    const summary = historySummary(historico(['parado', 'sem_dado', 'incerto', 'plantou']))

    expect(summary).toMatchObject({ idle: 1, planted: 1, uncertain: 2, known: 2, total: 4 })
    expect(summary?.situations).toEqual(['parado', 'sem_dado', 'incerto', 'plantou'])
  })

  it('os meses da linha da fonte saem da janela do satélite', () => {
    expect(historySummary(historico(['parado'], { janela: '05-15 a 08-31' }))?.window).toEqual({ from: 5, to: 8 })
  })

  it('sem a janela (formato antigo da API), vale a do guia: abril a julho', () => {
    const old = { ...historico(['parado']), janela: undefined } as unknown as Historico

    expect(historySummary(old)?.window).toEqual({ from: 4, to: 7 })
  })

  it('sem histórico do satélite, o cartão some (ADR 0002)', () => {
    expect(historySummary(null)).toBeNull()
  })

  it('sem nenhum ano certo, o cartão também some (não dá para dizer "parada em 0 de 0 anos")', () => {
    expect(historySummary(historico(['sem_dado', 'incerto']))).toBeNull()
  })
})

describe('rainPeriod', () => {
  it('lê o período da chuva do IMERG', () => {
    expect(rainPeriod([{ fonte: 'gpm_imerg', periodo: '2006-2025' }])).toEqual({ start: '2006', end: '2025' })
  })

  it('sem o IMERG, usa o período da chuva do NASA POWER', () => {
    expect(rainPeriod([{ fonte: 'nasa_power', periodo: '2005-2024' }])).toEqual({ start: '2005', end: '2024' })
  })

  it('sem a fonte, usa os 20 anos do PRD (2006 a 2025)', () => {
    expect(rainPeriod([])).toEqual({ start: '2006', end: '2025' })
  })
})

describe('soilSummary', () => {
  const solo = (fonte: 'soilgrids' | 'padrao' | 'usuario', textura: 'arenoso' | 'medio' | 'argiloso' = 'argiloso') =>
    ({ textura, cad_mm: 75, fonte }) as Talhao['solo']

  it('a terra do mapa de solos (SoilGrids)', () => {
    expect(soilSummary(solo('soilgrids'), undefined)).toEqual({ textura: 'argiloso', source: 'map' })
  })

  it('a escolha da pessoa (na URL) vale mais que o mapa', () => {
    expect(soilSummary(solo('soilgrids'), 'arenoso')).toEqual({ textura: 'arenoso', source: 'user' })
  })

  it('sem o mapa de solos, terra média', () => {
    expect(soilSummary(null, undefined)).toEqual({ textura: 'medio', source: 'default' })
    expect(soilSummary(solo('padrao', 'medio'), undefined)).toEqual({ textura: 'medio', source: 'default' })
  })
})
