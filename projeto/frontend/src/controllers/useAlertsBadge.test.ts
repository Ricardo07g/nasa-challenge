import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Avisos, PontoAvisos } from '../models/avisos'
import { buildAvisos } from '../repositories/mocks/mockAvisos'
import type { AvisosService } from '../services/avisosService'
import { providers } from '../test/providers'
import { useAlertsBadge } from './useAlertsBadge'

/** Avisos de exemplo com 2 cartões em "Agora"; `quiet` = sem nenhum aviso. */
function service(saved: PontoAvisos | null = null, quiet = false): AvisosService {
  return {
    get: vi.fn((point: PontoAvisos) => {
      const avisos = buildAvisos(point, 'pt')
      return Promise.resolve<Avisos>(quiet ? { ...avisos, contador: 0, agora: { avisos: [], ultima_leitura: null } } : avisos)
    }),
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

  it('a fazenda de exemplo nunca é guardada, mas o número é o dela (o mesmo da tela de avisos, pacote 3)', async () => {
    const avisos = service({ lat: -19.55, lon: -48.95 })
    const { result } = renderHook(() => useAlertsBadge(avisos), {
      wrapper: providers('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio&exemplo=1'),
    })

    expect(avisos.savePoint).not.toHaveBeenCalled()
    await waitFor(() => expect(result.current.count).toBe(2))
    expect(avisos.get).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, colheita: 'meio', exemplo: true }, 'pt')
    expect(result.current.to).toBe('/avisos?lat=-18.9543&lon=-48.1993&colheita=meio&exemplo=1')
  })

  it('o número conta só os avisos que a tela mostra: o relato de vizinho do `contador` da API fica de fora', async () => {
    const neighbor = {
      tipo: 'vizinho_evento',
      nivel: 'fique_de_olho' as const,
      fontes: ['comunidade'],
      data: '2026-11-14',
      antiga: false,
      valores: { evento: 'geada', relatos: 1 },
    }
    const avisos: AvisosService = {
      ...service({ lat: -18.9, lon: -48.2 }),
      get: vi.fn((point: PontoAvisos) =>
        Promise.resolve<Avisos>({ ...buildAvisos(point, 'pt'), contador: 3, perto: { avisos: [neighbor], ultima_leitura: null } }),
      ),
    }
    const { result } = renderHook(() => useAlertsBadge(avisos), { wrapper: providers('/') })

    await waitFor(() => expect(result.current.count).toBe(2))
  })

  it('sem ponto, o botão fica sem número e a API não é chamada', () => {
    const avisos = service()
    const { result } = renderHook(() => useAlertsBadge(avisos), { wrapper: providers('/') })

    expect(result.current).toEqual({ to: '/avisos', count: null })
    expect(avisos.get).not.toHaveBeenCalled()
  })

  it('sem aviso ativo ou com falha da API, o botão fica sem número', async () => {
    const none = service({ lat: -18.9, lon: -48.2 }, true)
    const failing: AvisosService = { ...service({ lat: -18.9, lon: -48.2 }), get: vi.fn().mockRejectedValue(new Error('x')) }

    const a = renderHook(() => useAlertsBadge(none), { wrapper: providers('/') })
    const b = renderHook(() => useAlertsBadge(failing), { wrapper: providers('/') })

    await waitFor(() => expect(none.get).toHaveBeenCalled())
    await waitFor(() => expect(failing.get).toHaveBeenCalled())
    expect(a.result.current.count).toBeNull()
    expect(b.result.current.count).toBeNull()
  })
})
