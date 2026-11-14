import { describe, expect, it } from 'vitest'
import type { Recomendacao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import { reportSources } from './reportService'

const talhao = (extra: Partial<Talhao> = {}) =>
  ({
    dados: [{ fonte: 'nasa_power', periodo: '2005-2024' }],
    solo: { textura: 'medio', cad_mm: 50, fonte: 'padrao' },
    historico: null,
    ...extra,
  }) as Talhao

describe('reportSources (relatório, P2)', () => {
  it('só as fontes que a conta usou de fato (API real hoje: só o NASA POWER)', () => {
    expect(reportSources(talhao(), {} as Recomendacao)).toEqual(['NASA POWER'])
  })

  it('soma chuva do IMERG, clima do CMIP6, histórico do MODIS, terra do SoilGrids e as fontes do sinal', () => {
    const full = talhao({
      dados: [
        { fonte: 'gpm_imerg', periodo: '2006-2025' },
        { fonte: 'nasa_power', periodo: '2006-2025' },
        { fonte: 'nex_gddp_cmip6', periodo: '2041-2060' },
      ],
      solo: { textura: 'argiloso', cad_mm: 75, fonte: 'soilgrids' },
      historico: {
        anos: [],
        parado: 5,
        plantou: 4,
        sem_certeza: 1,
        total: 10,
        fonte: 'MODIS MOD13Q1 + MYD13Q1',
        janela: '04-01 a 07-31',
      },
    })
    const rec = { sinal: { fonte: ['GEOS-S2S', 'SMAP'] } } as Recomendacao

    expect(reportSources(full, rec)).toEqual([
      'GPM IMERG',
      'NASA POWER',
      'NEX-GDDP-CMIP6',
      'MODIS',
      'SoilGrids',
      'GEOS-S2S',
      'SMAP',
    ])
  })

  it('fonte desconhecida aparece como veio, sem repetir', () => {
    const rec = { sinal: { fonte: ['NASA POWER'] } } as Recomendacao

    expect(reportSources(talhao({ dados: [{ fonte: 'outra_fonte', periodo: '' }, { fonte: 'nasa_power', periodo: '' }] }), rec)).toEqual([
      'outra_fonte',
      'NASA POWER',
    ])
  })
})
