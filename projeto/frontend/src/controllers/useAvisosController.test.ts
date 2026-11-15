import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Avisos, PontoAvisos } from '../models/avisos'
import { ApiError } from '../repositories/httpClient'
import { buildAvisos } from '../repositories/mocks/mockAvisos'
import type { AvisosService } from '../services/avisosService'
import { providers } from '../test/providers'
import { useAvisosController } from './useAvisosController'

const FIELD = '/avisos?lat=-18.9543&lon=-48.1993&colheita=meio'

function deps(
  saved: PontoAvisos | null = null,
  get: (point: PontoAvisos) => Promise<Avisos> = (point) => Promise.resolve(buildAvisos(point, 'pt')),
) {
  const avisos: AvisosService = {
    get: vi.fn(get),
    savedPoint: vi.fn(() => saved),
    savePoint: vi.fn(),
  }
  return { avisos }
}

describe('useAvisosController (tela "Avisos")', () => {
  it('sem ponto na URL nem salvo no aparelho, pede para marcar a lavoura e não chama a API', () => {
    const d = deps()
    const { result } = renderHook(() => useAvisosController(d), { wrapper: providers('/avisos') })

    expect(result.current.status).toBe('no-point')
    expect(result.current.markTo).toBe('/onde')
    expect(d.avisos.get).not.toHaveBeenCalled()
  })

  it('a fazenda de exemplo não vale como ponto da lavoura', () => {
    const d = deps()
    const { result } = renderHook(() => useAvisosController(d), {
      wrapper: providers('/avisos?lat=-18.9543&lon=-48.1993&colheita=meio&exemplo=1'),
    })

    expect(result.current.status).toBe('no-point')
  })

  it('usa o ponto da URL: os grupos na ordem, o lugar e o link do ano na resposta', async () => {
    const d = deps({ lat: -19.5, lon: -48.9 })
    const { result } = renderHook(() => useAvisosController(d), { wrapper: providers(FIELD) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(d.avisos.get).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')
    expect(result.current.groups.map((g) => g.key)).toEqual(['agora', 'mudou', 'recordes', 'perto'])
    expect(result.current.place).toBe('Uberlândia (MG)')
    expect(result.current.explorerTo).toBe('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio&ano=2024')
    expect(result.current.backTo).toBe('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')
  })

  it('sem ponto na URL, usa o ponto salvo no aparelho', async () => {
    const d = deps({ lat: -19.55, lon: -48.95, colheita: 'tarde' })
    const { result } = renderHook(() => useAvisosController(d), { wrapper: providers('/avisos') })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(d.avisos.get).toHaveBeenCalledWith({ lat: -19.55, lon: -48.95, colheita: 'tarde' }, 'pt')
    expect(result.current.backTo).toBe('/')
  })

  it('durante a safrinha não há link do ano (os avisos do plantio já aparecem em "Agora")', async () => {
    const d = deps(null, (point) => {
      const avisos = buildAvisos(point, 'pt')
      return Promise.resolve({ ...avisos, safrinha: { ...avisos.safrinha!, em_andamento: true } })
    })
    const { result } = renderHook(() => useAvisosController(d), { wrapper: providers(FIELD) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.explorerTo).toBeNull()
  })

  it('ponto fora da área preparada e erro de rede viram estados próprios', async () => {
    const outside = deps(null, () => Promise.reject(new ApiError('/api/avisos', 404, 'OUTSIDE_AREA')))
    const failing = deps(null, () => Promise.reject(new Error('rede')))

    const a = renderHook(() => useAvisosController(outside), { wrapper: providers(FIELD) })
    const b = renderHook(() => useAvisosController(failing), { wrapper: providers(FIELD) })

    await waitFor(() => expect(a.result.current.status).toBe('outside'))
    await waitFor(() => expect(b.result.current.status).toBe('error'))
  })
})
