import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { useWhereController } from './useWhereController'

function deps(position = { lat: -19.0, lon: -48.0 }) {
  const farm: FarmService = { talhao: vi.fn().mockResolvedValue({}), recomendacao: vi.fn() }
  const positionService = { current: vi.fn().mockResolvedValue(position) }
  return { farm, positionService }
}

describe('useWhereController (tela 2)', () => {
  it('começa na fazenda de exemplo, perto de Uberlândia', () => {
    const { result } = renderHook(() => useWhereController(deps()), { wrapper: providers('/onde') })

    expect(result.current.center).toEqual({ lat: -18.9543, lon: -48.1993 })
    expect(result.current.place).toBe('Uberlândia (MG)')
    expect(result.current.outside).toBe(false)
  })

  it('volta ao ponto que já estava na URL', () => {
    const { result } = renderHook(() => useWhereController(deps()), {
      wrapper: providers('/onde?lat=-19.74&lon=-47.93'),
    })

    expect(result.current.center).toEqual({ lat: -19.74, lon: -47.93 })
    expect(result.current.place).toBe('Uberaba (MG)')
  })

  it('arrastar o mapa muda o ponto e avisa quando sai da área preparada', () => {
    const { result } = renderHook(() => useWhereController(deps()), { wrapper: providers('/onde') })

    act(() => result.current.move({ lat: -15.8, lon: -47.9 }))

    expect(result.current.outside).toBe(true)
  })

  it('"Usar onde estou agora" centraliza no GPS', async () => {
    const d = deps({ lat: -19.1, lon: -48.1 })
    const { result } = renderHook(() => useWhereController(d), { wrapper: providers('/onde') })

    act(() => result.current.useMyLocation())
    expect(result.current.locating).toBe(true)

    await waitFor(() => expect(result.current.center).toEqual({ lat: -19.1, lon: -48.1 }))
    expect(result.current.locating).toBe(false)
  })

  it('mostra erro quando o GPS falha', async () => {
    const d = deps()
    d.positionService.current.mockRejectedValueOnce(new Error('negado'))
    const { result } = renderHook(() => useWhereController(d), { wrapper: providers('/onde') })

    act(() => result.current.useMyLocation())

    await waitFor(() => expect(result.current.locationError).toBe(true))
  })

  it('"É aqui" já busca o talhão e vai para a pergunta 2', () => {
    const d = deps()
    const { result } = renderHook(() => useWhereController(d), { wrapper: providers('/onde') })

    act(() => result.current.confirm())

    expect(d.farm.talhao).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993 }, 'pt')
    expect(screen.getByTestId('location')).toHaveTextContent('/quando?lat=-18.9543&lon=-48.1993')
  })
})
