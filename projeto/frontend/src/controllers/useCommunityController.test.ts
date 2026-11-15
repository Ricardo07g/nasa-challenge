import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RelatoComunidade, RelatosVizinhos } from '../models/community'
import { ApiError } from '../repositories/httpClient'
import { buildTalhao } from '../repositories/mocks/fixtures'
import { createMockRegionRepository } from '../repositories/mocks/mockRepositories'
import type { CommunityService } from '../services/communityService'
import type { FarmService } from '../services/farmService'
import type { SpeechService } from '../services/speechService'
import { providers } from '../test/providers'
import { useCommunityController } from './useCommunityController'

const region = createMockRegionRepository(0)
const TODAY = '2026-11-15'
const FIELD = '/comunidade?lat=-18.9543&lon=-48.1993&colheita=meio'

function relato(changes: Partial<RelatoComunidade>): RelatoComunidade {
  return {
    id: 'r1',
    tipo: 'chuva',
    subtipo: null,
    valores: { mm: 20 },
    celula: '-190_-482',
    lat: -18.95,
    lon: -48.15,
    data_fato: TODAY,
    meu: false,
    ...changes,
  }
}

const NEARBY: RelatosVizinhos = {
  raio_km: 30,
  anos_safra: [2024, 2025, 2026],
  relatos: [
    relato({ id: 'chuva-1' }),
    relato({ id: 'meu-1', tipo: 'evento', subtipo: 'geada', valores: {}, meu: true }),
    relato({ id: 'p1', tipo: 'plantio', subtipo: 'milheto', valores: { ano: 2026, resultado: 'bem' }, data_fato: null }),
  ],
}

function deps(nearby: () => Promise<RelatosVizinhos> = () => Promise.resolve(NEARBY)) {
  let seen = false
  const community: CommunityService = {
    nearby: vi.fn(nearby),
    send: vi.fn(async (report) => {
      seen = true
      return relato({ id: 'novo', tipo: report.tipo, meu: true })
    }),
    remove: vi.fn().mockResolvedValue(undefined),
    noticeSeen: vi.fn(() => seen),
    region: vi.fn((point, lang) => region.get(point, lang)),
  }
  const farm: FarmService = { talhao: vi.fn((point) => Promise.resolve(buildTalhao(point, 'pt'))), recomendacao: vi.fn() }
  return { community, farm, today: () => TODAY }
}

const speech = (): SpeechService => ({ isSupported: () => true, speak: vi.fn(), stop: vi.fn() })

describe('useCommunityController: "Ouvir resumo" (regra geral 9 do pacote 2)', () => {
  it('o raio, o plantio da safra mais recente (pela safra) e o aviso de relato de vizinho', async () => {
    const d = { ...deps(), speech: speech() }
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.listen.toggle())
    expect(d.speech.speak).toHaveBeenCalledWith(
      'Aqui você vê o que os vizinhos contam, até 30 km da sua lavoura, e conta o que aconteceu aí. 1 vizinho contou o que fez depois da soja 2025/26. Todo relato é de vizinho e não é confirmado.',
      'pt',
      expect.any(Function),
    )
  })

  it('sem relatos: diz que ainda não há relatos', async () => {
    const d = { ...deps(() => Promise.resolve({ ...NEARBY, relatos: [] })), speech: speech() }
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD, 'en') })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.listen.toggle())
    expect(d.speech.speak).toHaveBeenCalledWith(
      'Here you see what neighbors report, up to 30 km from your field, and tell what happened there. There are no reports near you yet. Every report comes from a neighbor and is not confirmed.',
      'en',
      expect.any(Function),
    )
  })
})

describe('useCommunityController (tela "Na sua região", relatos da comunidade)', () => {
  it('carrega os relatos em volta da lavoura marcada: resumo, mapa e os meus', async () => {
    const d = deps()
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(d.community.nearby).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993 }, 'pt')
    expect(result.current.radiusKm).toBe(30)
    expect(result.current.summary?.rain).toEqual({ averageMm: 20, count: 1, example: false })
    expect(result.current.summary?.planting?.year).toBe(2026)
    expect(result.current.summary?.mine.map((r) => r.id)).toEqual(['meu-1'])
    expect(result.current.markers).toHaveLength(1)
    expect(result.current.canTell).toBe(true)
  })

  it('sem ponto marcado (ou na fazenda de exemplo), mostra a redondeza mas não deixa contar', async () => {
    const d = deps()
    const withoutPoint = renderHook(() => useCommunityController(d), { wrapper: providers('/comunidade') })
    const example = renderHook(() => useCommunityController(d), {
      wrapper: providers('/comunidade?lat=-18.9543&lon=-48.1993&exemplo=1'),
    })

    await waitFor(() => expect(withoutPoint.result.current.status).toBe('ready'))
    expect(withoutPoint.result.current.center).toEqual({ lat: -18.9543, lon: -48.1993 })
    expect(withoutPoint.result.current.canTell).toBe(false)
    expect(example.result.current.canTell).toBe(false)
    expect(withoutPoint.result.current.markTo).toBe('/onde')
  })

  it('comunidade sem banco no servidor (503): os blocos não aparecem (not-connected)', async () => {
    const d = deps(() => Promise.reject(new ApiError('/api/comunidade/relatos', 503, 'COMMUNITY_UNAVAILABLE')))
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD) })

    await waitFor(() => expect(result.current.status).toBe('not-connected'))
    expect(result.current.summary).toBeNull()
  })

  it('se falhar por outro motivo, mostra o erro e tenta de novo', async () => {
    let calls = 0
    const d = deps(() => (++calls === 1 ? Promise.reject(new Error('rede')) : Promise.resolve(NEARBY)))
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD) })

    await waitFor(() => expect(result.current.status).toBe('error'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('"O que plantei": a safra mais recente já vem escolhida; cultura e como foi bastam para enviar', async () => {
    const d = deps()
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.openForm('plantio'))
    expect(result.current.form.planting.year).toBe(2026)
    expect(result.current.form.ready).toBe(false)
    act(() => result.current.setPlanting({ crop: 'milheto' }))
    act(() => result.current.setPlanting({ outcome: 'bem' }))
    expect(result.current.form.ready).toBe(true)
    expect(result.current.form.showNotice).toBe(true)
    await act(() => result.current.send())

    expect(d.community.send).toHaveBeenCalledWith({
      tipo: 'plantio',
      subtipo: 'milheto',
      valores: { ano: 2026, resultado: 'bem' },
      lat: -18.9543,
      lon: -48.1993,
      data_fato: null,
    })
    expect(result.current.form.result).toBe('sent')
    expect(result.current.form.open).toBeNull()
    expect(result.current.form.showNotice).toBe(false)
    await waitFor(() => expect(d.community.nearby).toHaveBeenCalledTimes(2))
  })

  it('"Choveu aqui": a data já vem com hoje e os milímetros aceitam vírgula', async () => {
    const d = deps()
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.openForm('chuva'))
    expect(result.current.form.rain.date).toBe(TODAY)
    expect(result.current.form.bounds).toEqual({ min: '2026-10-16', max: TODAY })
    act(() => result.current.setRain({ mm: '12,5' }))
    await act(() => result.current.send())

    expect(d.community.send).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'chuva', valores: { mm: 12.5 }, data_fato: TODAY }),
    )
  })

  it('"Aconteceu aqui": ao escolher fogo, mostra o 193', async () => {
    const d = deps()
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.openForm('evento'))
    expect(result.current.form.fireCall).toBe(false)
    act(() => result.current.setEvent({ event: 'fogo' }))

    expect(result.current.form.fireCall).toBe(true)
    expect(result.current.form.ready).toBe(true)
  })

  it('passou do limite por dia: avisa e o aviso de privacidade continua', async () => {
    const d = deps()
    d.community.send = vi.fn().mockRejectedValue(new ApiError('/api/comunidade/relatos', 429, 'TOO_MANY_REPORTS', 'POST'))
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.openForm('evento'))
    act(() => result.current.setEvent({ event: 'granizo' }))
    await act(() => result.current.send())

    expect(result.current.form.result).toBe('limit')
    expect(result.current.form.open).toBe('evento')
    expect(result.current.form.showNotice).toBe(true)
  })

  it('apagar o próprio relato e recarregar a redondeza', async () => {
    const d = deps()
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await act(() => result.current.remove('meu-1'))

    expect(d.community.remove).toHaveBeenCalledWith('meu-1')
    await waitFor(() => expect(d.community.nearby).toHaveBeenCalledTimes(2))
  })

  it('o Voltar vai para a resposta quando há caminho na URL; senão, para o início', () => {
    const d = deps()
    const withFlow = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD) })
    const withoutFlow = renderHook(() => useCommunityController(d), { wrapper: providers('/comunidade') })

    expect(withFlow.result.current.backTo).toBe('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')
    expect(withoutFlow.result.current.backTo).toBe('/')
  })

  it('região pelo satélite: o último ano, a média e o histórico da lavoura para comparar (P3)', async () => {
    const d = deps()
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD) })

    await waitFor(() => expect(result.current.region).not.toBeNull())
    expect(result.current.region?.last).toEqual({ ano: 2025, pct: 62 })
    expect(result.current.regionRadius).toBe(30)
    await waitFor(() => expect(result.current.history).toEqual({ idle: 5, known: 9, uncertain: 1 }))
  })

  it('sem o arquivo da região (404 OUTSIDE_AREA): o bloco do satélite fica escondido', async () => {
    const d = deps()
    d.community.region = vi.fn().mockRejectedValue(new ApiError('/api/regiao', 404, 'OUTSIDE_AREA'))
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD) })

    await waitFor(() => expect(result.current.regionStatus).toBe('outside'))
    expect(result.current.region).toBeNull()
  })

  it('sem o endpoint da região (404 sem código): "not-connected"', async () => {
    const d = deps()
    d.community.region = vi.fn().mockRejectedValue(new ApiError('/api/regiao', 404, null))
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD) })

    await waitFor(() => expect(result.current.regionStatus).toBe('not-connected'))
  })

  it('região de um círculo centrado longe da lavoura: diz a distância até o centro', async () => {
    const d = deps()
    d.community.region = vi.fn(async (point, lang) => ({ ...(await region.get(point, lang)), distancia_km: 12.3 }))
    const { result } = renderHook(() => useCommunityController(d), { wrapper: providers(FIELD) })

    await waitFor(() => expect(result.current.regionStatus).toBe('ready'))
    expect(result.current.regionDistance).toBe(12.3)
  })
})
