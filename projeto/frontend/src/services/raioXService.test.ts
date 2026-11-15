import { describe, expect, it, vi } from 'vitest'
import type { RaioX } from '../models/raioX'
import { buildRaioX } from '../repositories/mocks/raioXFixture'
import {
  alertList,
  createRaioXService,
  futureAgreement,
  ndviLevel,
  regionSide,
  soilParts,
  xRayBlocks,
} from './raioXService'

const RAIO: RaioX = buildRaioX({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')

describe('raioXService (raio-X da sua terra, tela 4)', () => {
  it('pede o raio-X ao repository', async () => {
    const repository = { get: vi.fn().mockResolvedValue(RAIO) }

    await createRaioXService(repository).get({ lat: 1, lon: 2, colheita: 'meio' }, 'pt')

    expect(repository.get).toHaveBeenCalledWith({ lat: 1, lon: 2, colheita: 'meio' }, 'pt')
  })

  it('os 8 blocos na ordem do painel, só os que têm dado', () => {
    expect(xRayBlocks(RAIO).map((block) => block.kind)).toEqual([
      'soil', 'water', 'moisture', 'green', 'rain', 'dryspell', 'heat', 'region',
    ]) // prettier-ignore
    const without = { ...RAIO, umidade: null, regiao: null }
    expect(xRayBlocks(without).map((block) => block.kind)).not.toContain('moisture')
    expect(xRayBlocks(without).map((block) => block.kind)).not.toContain('region')
  })

  it('sem raio-X, nenhum bloco', () => {
    expect(xRayBlocks(undefined)).toEqual([])
  })

  it('barra do solo: argila, silte (o resto) e areia, somando 100', () => {
    expect(soilParts({ textura: 'medio', argila_pct: 41.9, areia_pct: 40.2, cad_mm: 60, vizinho_km: null })).toEqual({
      clay: 42,
      silt: 18,
      sand: 40,
    })
  })

  it('nível de cor do NDVI em 5 faixas (0 = sem leitura)', () => {
    expect([null, 0.1, 0.3, 0.44, 0.45, 0.6, 0.74, 0.75, 0.95].map(ndviLevel)).toEqual([0, 1, 2, 2, 3, 4, 4, 5, 5])
  })

  it('alertas na ordem geada, chuva forte e fogo, só os que existem', () => {
    const alerts = alertList({
      ...RAIO,
      alertas: {
        geada: { anos: [2011], total_anos: 20, temp_c: 3, menor_temp_c: 2.4, fonte: 'nasa_power' },
        chuva_forte: null,
        fogo: { anos: [2017, 2021], total_anos: 10, raio_km: 5, fonte: 'MODIS MCD64A1' },
      },
    })

    expect(alerts.map((alert) => alert.kind)).toEqual(['frost', 'fire'])
    expect(alertList(undefined)).toEqual([])
  })

  it('a área contra a região: diz o lado que tem mais células', () => {
    expect(regionSide({ ...RAIO.regiao!, pct_mais_seca: 64, pct_mais_chuvosa: 35 })).toEqual({ side: 'drier', pct: 64 })
    expect(regionSide({ ...RAIO.regiao!, pct_mais_seca: 38, pct_mais_chuvosa: 62 })).toEqual({ side: 'wetter', pct: 62 })
  })

  it('concordância dos modelos: quantos indicam menos ou mais chuva, e mais calor', () => {
    const clima = RAIO.cartoes.clima_futuro!

    expect(futureAgreement({ ...clima, modelos_menos_chuva: 3, modelos_mais_chuva: 0 })).toEqual({
      rain: { direction: 'less', count: 3 },
      heat: 3,
      models: 3,
    })
    expect(futureAgreement({ ...clima, modelos_menos_chuva: 1, modelos_mais_chuva: 2 }).rain).toEqual({
      direction: 'more',
      count: 2,
    })
  })
})
