import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Talhao } from '../models/talhao'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { useWhenController } from './useWhenController'

const point = 'lat=-18.9543&lon=-48.1993'

function deps(talhao: Promise<Partial<Talhao>> = Promise.resolve({ colheita_sugerida: { faixa: 'cedo', fonte: 'ndvi_modis', anos_usados: 9 } })) {
  const farm: FarmService = { talhao: vi.fn().mockReturnValue(talhao), recomendacao: vi.fn().mockResolvedValue({}) }
  return { farm, today: () => new Date(2026, 10, 14) }
}

describe('useWhenController (tela 3)', () => {
  it('já deixa marcada a faixa que o satélite viu', async () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers(`/quando?${point}`) })

    await waitFor(() => expect(result.current.suggestion).toEqual({ faixa: 'cedo', fromSatellite: true }))
    expect(result.current.selected).toBe('cedo')
    expect(d.farm.talhao).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, exemplo: false }, 'pt')
  })

  it('a faixa que já está na URL vale mais que a sugestão (voltar da tela 4)', async () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), {
      wrapper: providers(`/quando?${point}&colheita=tarde`),
    })

    await waitFor(() => expect(result.current.suggestion).not.toBeNull())
    expect(result.current.selected).toBe('tarde')
  })

  it('se o talhão não carregar, fica no meio de fevereiro sem dizer que veio do satélite', async () => {
    const d = deps(Promise.reject(new Error('rede')))
    const { result } = renderHook(() => useWhenController(d), {
      wrapper: providers(`/quando?${point}`),
    })

    await waitFor(() => expect(result.current.suggestion).toEqual({ faixa: 'meio', fromSatellite: false }))
    expect(result.current.selected).toBe('meio')
  })

  it('escolher uma faixa fecha a data exata', async () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers(`/quando?${point}`) })
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    act(() => result.current.openDate())
    act(() => result.current.select('tarde'))

    expect(result.current.selected).toBe('tarde')
    expect(result.current.dateOpen).toBe(false)
  })

  it('a data exata vira a faixa; data fora da época não conta', async () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers(`/quando?${point}`) })
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    act(() => result.current.openDate())
    expect(result.current.window).toEqual({ min: '2027-01-15', max: '2027-03-31' })
    act(() => result.current.changeDate('2027-02-18'))
    expect(result.current.dateBand).toBe('meio')
    expect(result.current.selected).toBe('meio')

    act(() => result.current.changeDate('2027-05-02'))
    expect(result.current.dateBand).toBeNull()
    expect(result.current.selected).toBe('cedo')
  })

  it('"Próximo passo" leva a faixa na URL para a tela 4 e já pede a recomendação', async () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers(`/quando?${point}`) })
    await waitFor(() => expect(result.current.suggestion).not.toBeNull())

    act(() => result.current.confirm())

    expect(screen.getByTestId('location')).toHaveTextContent(`/satelite?${point}&colheita=cedo`)
    expect(d.farm.recomendacao).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, colheita: 'cedo', solo: undefined, exemplo: false },
      'pt',
    )
  })

  it('o Voltar leva para o mapa com o mesmo ponto', () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers(`/quando?${point}`) })

    expect(result.current.backTo).toBe(`/onde?${point}`)
  })

  it('sem ponto na URL, avisa para voltar ao mapa', () => {
    const d = deps()
    const { result } = renderHook(() => useWhenController(d), { wrapper: providers('/quando') })

    expect(result.current.missingPoint).toBe(true)
  })
})
