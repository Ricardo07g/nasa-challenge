import { act, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Recomendacao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import { ApiError } from '../repositories/httpClient'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { useMissionController } from './useMissionController'

const flow = 'lat=-18.9543&lon=-48.1993&colheita=meio'
const talhao = {
  ponto: { lat: -18.9543, lon: -48.1993 },
  dentro_da_area: true,
  solo: { textura: 'medio', cad_mm: 50, fonte: 'soilgrids' },
  dados: [{ fonte: 'nasa_power', periodo: '2005-2024' }],
  historico: {
    anos: [
      { ano: 2024, situacao: 'parado', ndvi_max: 0.42, n_obs: 12 },
      { ano: 2025, situacao: 'incerto', ndvi_max: 0.52, n_obs: 11 },
    ],
    parado: 1,
    plantou: 0,
    sem_certeza: 1,
    total: 2,
    fonte: 'MODIS MOD13Q1 + MYD13Q1',
    janela: '04-01 a 07-31',
  },
} as unknown as Talhao
const rec = { sinal: { nivel: 'incerto' } } as Recomendacao

function deps(overrides: Partial<FarmService> = {}) {
  const farm: FarmService = {
    talhao: vi.fn().mockResolvedValue(talhao),
    recomendacao: vi.fn().mockResolvedValue(rec),
    ...overrides,
  }
  return { farm }
}

/** Avança o relógio falso e deixa as promessas resolverem. */
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

describe('useMissionController (tela de cálculo, RF-19)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('passa pelas 6 fases, cada uma com no mínimo 1,2 s, e segue sozinha para a tela 4', async () => {
    const d = deps()
    const { result } = renderHook(() => useMissionController(d), { wrapper: providers(`/calculando?${flow}`) })

    await advance(0)
    expect(result.current.status).toBe('ready')
    expect(result.current.phase).toBe(0)
    await advance(1199)
    expect(result.current.phase).toBe(0)
    await advance(1)
    expect(result.current.phase).toBe(1)
    for (let next = 2; next <= 6; next++) {
      await advance(1200)
      expect(result.current.phase).toBe(next)
    }
    expect(result.current.complete).toBe(true)

    await advance(3000)
    expect(screen.getByTestId('location')).toHaveTextContent(`/satelite?${flow}`)
  })

  it('mostra os dados reais que chegaram (ponto, terra, anos de chuva, histórico, sinal)', async () => {
    const d = deps()
    const { result } = renderHook(() => useMissionController(d), { wrapper: providers(`/calculando?${flow}`) })

    await advance(0)
    expect(result.current.facts).toEqual({
      point: { lat: -18.9543, lon: -48.1993 },
      soil: 'medio',
      soilSource: 'SoilGrids',
      smap: null,
      rainYears: 20,
      rainSource: 'NASA POWER',
      historyYears: 1,
      future: null,
      signal: 'incerto',
      signalSource: null,
      options: null,
    })
    expect(result.current.place).toBe('Uberlândia (MG)')
  })

  it('não avança enquanto os dados não chegam; depois de 20 s avisa que o sinal está fraco', async () => {
    const d = deps({ recomendacao: vi.fn(() => new Promise<Recomendacao>(() => {})) })
    const { result } = renderHook(() => useMissionController(d), { wrapper: providers(`/calculando?${flow}`) })

    await advance(19_000)
    expect(result.current.phase).toBe(0)
    expect(result.current.weak).toBe(false)
    await advance(1_000)
    expect(result.current.weak).toBe(true)

    act(() => result.current.waitMore())
    expect(result.current.weak).toBe(false)
  })

  it('erro ao buscar os dados: mostra o erro e tenta de novo', async () => {
    let calls = 0
    const d = deps({
      recomendacao: vi.fn(() => (++calls === 1 ? Promise.reject(new Error('rede')) : Promise.resolve(rec))),
    })
    const { result } = renderHook(() => useMissionController(d), { wrapper: providers(`/calculando?${flow}`) })

    await advance(0)
    expect(result.current.status).toBe('error')
    act(() => result.current.retry())
    await advance(0)
    expect(result.current.status).toBe('ready')
  })

  it('ponto sem dados no servidor vira "fora da área"', async () => {
    const d = deps({ recomendacao: vi.fn().mockRejectedValue(new ApiError('/api/recomendacao', 404, 'OUTSIDE_AREA')) })
    const { result } = renderHook(() => useMissionController(d), { wrapper: providers(`/calculando?${flow}`) })

    await advance(0)
    expect(result.current.status).toBe('outside')
  })

  it('tocar no satélite é só brincadeira: gira, mas não acelera', async () => {
    const d = deps()
    const { result } = renderHook(() => useMissionController(d), { wrapper: providers(`/calculando?${flow}`) })
    await advance(0)

    act(() => result.current.spin())
    act(() => result.current.spin())

    expect(result.current.spins).toBe(2)
    expect(result.current.phase).toBe(0)
  })

  it('Voltar vai para a pergunta 2; sem colheita volta para ela; sem ponto, para o mapa', () => {
    const d = deps()
    const mission = renderHook(() => useMissionController(d), { wrapper: providers(`/calculando?${flow}`) })
    const noHarvest = renderHook(() => useMissionController(d), {
      wrapper: providers('/calculando?lat=-18.9543&lon=-48.1993'),
    })
    const noPoint = renderHook(() => useMissionController(d), { wrapper: providers('/calculando') })

    expect(mission.result.current.backTo).toBe(`/quando?${flow}`)
    expect(mission.result.current.continueTo).toBe(`/satelite?${flow}`)
    expect(noHarvest.result.current.redirectTo).toBe('/quando?lat=-18.9543&lon=-48.1993')
    expect(noPoint.result.current.redirectTo).toBe('/onde')
  })
})
