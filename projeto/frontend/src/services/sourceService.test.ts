import { describe, expect, it } from 'vitest'
import type { Talhao } from '../models/talhao'
import { rainResolutionKm, sourceStatuses } from './sourceService'

const talhao = (over: Partial<Talhao> = {}): Talhao => ({
  ponto: { lat: -18.9543, lon: -48.1993 },
  celula_id: '-190_-482',
  dentro_da_area: true,
  solo: { textura: 'argiloso', cad_mm: 60, fonte: 'soilgrids' },
  colheita_sugerida: null,
  historico: null,
  dados: [{ fonte: 'nasa_power', periodo: '2005-2024' }],
  ...over,
})

describe('sourceStatuses (tela 9, de onde vem cada dado)', () => {
  it('com a API de hoje: NASA POWER (dados[]) e SoilGrids (solo) conectados; o resto ainda não, conectados primeiro', () => {
    expect(sourceStatuses(talhao())).toEqual([
      { key: 'nasa_power', connected: true },
      { key: 'soilgrids', connected: true },
      { key: 'gpm_imerg', connected: false },
      { key: 'smap', connected: false },
      { key: 'modis', connected: false },
      { key: 'nex_gddp_cmip6', connected: false },
    ])
  })

  it('IMERG, SMAP e CMIP6 em dados[] e o histórico do MODIS contam como conectados', () => {
    const full = talhao({
      dados: [
        { fonte: 'gpm_imerg', periodo: '2005-2024' },
        { fonte: 'nasa_power', periodo: '2005-2024' },
        { fonte: 'smap', periodo: '2015-2024' },
        { fonte: 'nex_gddp_cmip6', periodo: '2041-2060' },
      ],
      historico: { anos: [], parado: 0, plantou: 0, sem_certeza: 0, total: 0, fonte: 'MODIS', janela: '04-01 a 07-31' },
    })

    expect(sourceStatuses(full).every((source) => source.connected)).toBe(true)
  })

  it('terra padrão (sem o mapa de solos) não conta o SoilGrids como conectado', () => {
    const statuses = sourceStatuses(talhao({ solo: { textura: 'medio', cad_mm: 50, fonte: 'padrao' } }))

    expect(statuses.find((source) => source.key === 'soilgrids')?.connected).toBe(false)
  })
})

describe('rainResolutionKm', () => {
  it('a chuva de hoje vem do NASA POWER, em quadrados de cerca de 50 km', () => {
    expect(rainResolutionKm(talhao())).toBe(50)
  })

  it('com o IMERG conectado, 10 km', () => {
    expect(rainResolutionKm(talhao({ dados: [{ fonte: 'gpm_imerg', periodo: '2005-2024' }] }))).toBe(10)
  })

  it('sem fonte de chuva, não inventa o tamanho', () => {
    expect(rainResolutionKm(talhao({ dados: [] }))).toBeNull()
  })
})
