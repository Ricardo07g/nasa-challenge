import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Community } from '../models/community'
import { ApiError, NotConnectedError } from '../repositories/httpClient'
import { buildCommunity, buildTalhao } from '../repositories/mocks/fixtures'
import { createMockRegionRepository } from '../repositories/mocks/mockRepositories'
import type { FarmService } from '../services/farmService'
import type { CommunityService } from '../services/communityService'
import { providers } from '../test/providers'
import { useCommunityController } from './useCommunityController'

const region = createMockRegionRepository(0)

function deps(load: () => Promise<Community> = () => Promise.resolve(buildCommunity('pt'))) {
  const community: CommunityService = { get: vi.fn(load), region: vi.fn((point, lang) => region.get(point, lang)) }
  const farm: FarmService = { talhao: vi.fn((point) => Promise.resolve(buildTalhao(point, 'pt'))), recomendacao: vi.fn() }
  return { community, farm }
}

describe('useCommunityController (tela 8)', () => {
  it('carrega a comunidade; sem ponto na URL, o mapa fica na fazenda de exemplo', async () => {
    const d = deps()
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers('/comunidade') })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.community?.participantes).toBe(18)
    expect(result.current.center).toEqual({ lat: -18.9543, lon: -48.1993 })
    expect(result.current.points).toHaveLength(9)
    expect(d.community.get).toHaveBeenCalledWith('pt')
  })

  it('com o ponto da lavoura na URL, o mapa fica na região dela', () => {
    const d = deps()
    const { result } = renderHook(() => useCommunityController(d), {
      wrapper: providers('/comunidade?lat=-19.74&lon=-47.93'),
    })

    expect(result.current.center).toEqual({ lat: -19.74, lon: -47.93 })
  })

  it('o Voltar vai para a resposta quando há caminho na URL; senão, para o início', () => {
    const d = deps()
    const withFlow = renderHook(() => useCommunityController(d), {
      wrapper: providers('/comunidade?lat=-18.9543&lon=-48.1993&colheita=meio'),
    })
    const withoutFlow = renderHook(() => useCommunityController(d), { wrapper: providers('/comunidade') })

    expect(withFlow.result.current.backTo).toBe('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')
    expect(withoutFlow.result.current.backTo).toBe('/')
  })

  it('os botões da tela simulada só mostram o aviso de demonstração', async () => {
    const d = deps()
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers('/comunidade') })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.demo).toBeNull()
    act(() => result.current.showDemo('rain'))
    expect(result.current.demo).toBe('rain')
  })

  it('se não carregar, mostra o erro e tenta de novo', async () => {
    let calls = 0
    const d = deps(() => (++calls === 1 ? Promise.reject(new Error('x')) : Promise.resolve(buildCommunity('pt'))))
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers('/comunidade') })

    await waitFor(() => expect(result.current.status).toBe('error'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('região pelo satélite: o último ano, a média e o histórico da lavoura para comparar (P3)', async () => {
    const d = deps()
    const { result } = renderHook(() => useCommunityController(d), {
      wrapper: providers('/comunidade?lat=-18.9543&lon=-48.1993&colheita=meio'),
    })

    await waitFor(() => expect(result.current.region).not.toBeNull())
    expect(result.current.region?.last).toEqual({ ano: 2025, pct: 62 })
    expect(result.current.regionRadius).toBe(30)
    // A lavoura de exemplo tem 5 anos parados, 4 plantados e 1 sem certeza: conta só os anos certos.
    await waitFor(() => expect(result.current.history).toEqual({ idle: 5, known: 9, uncertain: 1 }))
    expect(d.community.region).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993 }, 'pt')
  })

  it('com a região pronta, o estado da região é "ready"', async () => {
    const d = deps()
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers('/comunidade') })

    await waitFor(() => expect(result.current.regionStatus).toBe('ready'))
    // Os dados de exemplo são o círculo em volta da própria lavoura: sem distância a mostrar.
    expect(result.current.regionDistance).toBeNull()
  })

  it('região de um círculo centrado longe da lavoura: diz a distância até o centro', async () => {
    const d = deps()
    d.community.region = vi.fn(async (point, lang) => ({ ...(await region.get(point, lang)), distancia_km: 12.3 }))
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers('/comunidade') })

    await waitFor(() => expect(result.current.regionStatus).toBe('ready'))
    expect(result.current.regionRadius).toBe(30)
    expect(result.current.regionDistance).toBe(12.3)
  })

  it('sem o endpoint da região no backend (404 sem código), a região fica "not-connected" (a tela não mostra)', async () => {
    const d = deps()
    d.community.region = vi.fn().mockRejectedValue(new ApiError('/api/regiao', 404, null))
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers('/comunidade') })

    await waitFor(() => expect(result.current.regionStatus).toBe('not-connected'))
    expect(result.current.region).toBeNull()
    expect(result.current.regionRadius).toBeNull()
  })

  it('ponto fora das regiões que o satélite já mediu (404 OUTSIDE_AREA): estado próprio, nem erro nem "not-connected"', async () => {
    const d = deps()
    d.community.region = vi.fn().mockRejectedValue(new ApiError('/api/regiao', 404, 'OUTSIDE_AREA'))
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers('/comunidade') })

    await waitFor(() => expect(result.current.regionStatus).toBe('outside'))
    expect(result.current.region).toBeNull()
    expect(result.current.regionRadius).toBeNull()
    expect(result.current.regionDistance).toBeNull()
  })

  it('se a região falhar por outro motivo, mostra o erro e tenta de novo', async () => {
    let calls = 0
    const d = deps()
    d.community.region = vi.fn((point, lang) =>
      ++calls === 1 ? Promise.reject(new ApiError('/api/regiao', 500, null)) : region.get(point, lang),
    )
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers('/comunidade') })

    await waitFor(() => expect(result.current.regionStatus).toBe('error'))
    act(() => result.current.retryRegion())
    await waitFor(() => expect(result.current.regionStatus).toBe('ready'))
  })

  it('com a API real (comunidade sem versão http): nada de vizinho simulado, fica "not-connected" (a tela não mostra)', async () => {
    const d = deps(() => Promise.reject(new NotConnectedError('comunidade')))
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers('/comunidade') })

    await waitFor(() => expect(result.current.status).toBe('not-connected'))
    expect(result.current.community).toBeNull()
    expect(result.current.points).toEqual([])
  })
})
