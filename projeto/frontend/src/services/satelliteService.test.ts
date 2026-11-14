import { describe, expect, it } from 'vitest'
import type { Talhao } from '../models/talhao'
import { historySummary, rainPeriod, soilSummary } from './satelliteService'

describe('historySummary', () => {
  it('conta os anos parados e plantados e mantém a situação de cada ano', () => {
    const historico: Talhao['historico'] = {
      anos: [
        { ano: 2016, situacao: 'parado', ndvi_max: 0.42 },
        { ano: 2017, situacao: 'plantou', ndvi_max: 0.71 },
        { ano: 2018, situacao: 'incerto', ndvi_max: 0.55 },
      ],
      parado: 1,
      total: 3,
      fonte: 'modis_mod13q1',
    }

    expect(historySummary(historico)).toEqual({
      idle: 1,
      planted: 1,
      total: 3,
      situations: ['parado', 'plantou', 'incerto'],
      years: ['2016', '2017', '2018'],
    })
  })

  it('sem histórico do satélite, o cartão some (ADR 0002)', () => {
    expect(historySummary(null)).toBeNull()
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
