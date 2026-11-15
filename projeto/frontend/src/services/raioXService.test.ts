import { describe, expect, it, vi } from 'vitest'
import type { FaixaNdvi, RaioX } from '../models/raioX'
import type { Historico } from '../models/talhao'
import { buildRaioX } from '../repositories/mocks/raioXFixture'
import {
  alertList,
  createRaioXService,
  futureAgreement,
  heatmap,
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

  const historico: Historico = {
    anos: [
      { ano: 2017, situacao: 'parado', ndvi_max: 0.3, n_obs: 5, fonte_ano: 'satelite' },
      { ano: 2018, situacao: 'plantou', ndvi_max: 0.8, n_obs: 5, fonte_ano: 'produtor' },
    ],
    parado: 1,
    plantou: 1,
    sem_certeza: 0,
    total: 2,
    fonte: 'MODIS',
    janela: '04-01 a 07-31',
  }

  const strip: FaixaNdvi = {
    colunas: ['01-01', '01-17', '02-02', '02-18', '03-06', '03-22', '04-07'],
    anos: [
      { ano: 2017, valores: [0.8, 0.82, 0.5, 0.3, null, 0.31, 0.32] },
      { ano: 2018, valores: [0.81, 0.84, 0.6, 0.35, 0.5, 0.7, 0.75] },
    ],
    fonte: 'MODIS MOD13Q1 + MYD13Q1',
    colheita_dia: '02-25',
  }

  it('faixa de calor: um ano por linha, com o nível de cada leitura e o que aconteceu no ano', () => {
    const model = heatmap(strip, historico)!

    expect(model.rows.map((row) => row.year)).toEqual([2017, 2018])
    expect(model.rows[0].cells.map((cell) => cell.level)).toEqual([5, 5, 3, 2, 0, 2, 2])
    expect(model.rows[0].situation).toBe('parado')
    expect(model.rows[1]).toMatchObject({ situation: 'plantou', byProducer: true })
  })

  it('marca a soja até a coluna da colheita e a entressafra depois dela', () => {
    const model = heatmap(strip, historico)!

    // 25/fev cai na coluna de 18/fev (4ª): soja nas 3 primeiras, colheita na 4ª, entressafra depois.
    expect(model.marks).toEqual({ soy: [0, 3], harvest: 3, offseason: [4, 7] })
    expect(model.months).toEqual([
      { month: 1, from: 0 },
      { month: 2, from: 2 },
      { month: 3, from: 4 },
      { month: 4, from: 6 },
    ])
  })

  it('sem o dia da colheita, a entressafra começa em abril (a janela do histórico) e sem marca de colheita', () => {
    const model = heatmap({ ...strip, colheita_dia: null }, historico)!

    expect(model.marks).toEqual({ soy: [0, 6], harvest: null, offseason: [6, 7] })
  })

  it('sem faixa, sem modelo', () => {
    expect(heatmap(null, historico)).toBeNull()
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
