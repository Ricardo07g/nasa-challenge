import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Avisos, PontoAvisos } from '../models/avisos'
import { buildAvisos } from '../repositories/mocks/mockAvisos'
import type { AvisosService } from '../services/avisosService'
import { providers } from '../test/providers'
import { useAlertsBadge } from './useAlertsBadge'

function service(saved: PontoAvisos | null = null, contador = 2): AvisosService {
  return {
    get: vi.fn((point: PontoAvisos) => Promise.resolve<Avisos>({ ...buildAvisos(point, 'pt'), contador })),
    savedPoint: vi.fn(() => saved),
    savePoint: vi.fn(),
  }
}

describe('useAlertsBadge (botão "Avisos" do cabeçalho)', () => {
  it('guarda no aparelho o ponto marcado no fluxo e mostra o número de avisos ativos', async () => {
    const avisos = service()
    const { result } = renderHook(() => useAlertsBadge(avisos), {
      wrapper: providers('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio'),
    })

    expect(avisos.savePoint).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, colheita: 'meio' })
    expect(result.current.to).toBe('/avisos?lat=-18.9543&lon=-48.1993&colheita=meio')
    await waitFor(() => expect(result.current.count).toBe(2))
  })

  it('a fazenda de exemplo não é guardada; vale o ponto salvo antes', async () => {
    const avisos = service({ lat: -19.55, lon: -48.95 })
    const { result } = renderHook(() => useAlertsBadge(avisos), {
      wrapper: providers('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio&exemplo=1'),
    })

    expect(avisos.savePoint).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.count).toBe(2))
    expect(avisos.get).toHaveBeenCalledWith({ lat: -19.55, lon: -48.95 }, 'pt')
  })

  it('sem ponto, o botão fica sem número e a API não é chamada', () => {
    const avisos = service()
    const { result } = renderHook(() => useAlertsBadge(avisos), { wrapper: providers('/') })

    expect(result.current).toEqual({ to: '/avisos', count: null })
    expect(avisos.get).not.toHaveBeenCalled()
  })

  it('sem aviso ativo ou com falha da API, o botão fica sem número', async () => {
    const none = service({ lat: -18.9, lon: -48.2 }, 0)
    const failing: AvisosService = { ...service({ lat: -18.9, lon: -48.2 }), get: vi.fn().mockRejectedValue(new Error('x')) }

    const a = renderHook(() => useAlertsBadge(none), { wrapper: providers('/') })
    const b = renderHook(() => useAlertsBadge(failing), { wrapper: providers('/') })

    await waitFor(() => expect(none.get).toHaveBeenCalled())
    await waitFor(() => expect(failing.get).toHaveBeenCalled())
    expect(a.result.current.count).toBeNull()
    expect(b.result.current.count).toBeNull()
  })
})
