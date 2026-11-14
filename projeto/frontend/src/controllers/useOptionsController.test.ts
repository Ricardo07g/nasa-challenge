import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Recomendacao } from '../models/recomendacao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { useOptionsController } from './useOptionsController'

const flow = 'lat=-18.9543&lon=-48.1993&colheita=meio'
const point = { lat: -18.9543, lon: -48.1993 }

function deps(load: () => Promise<Recomendacao> = () => Promise.resolve(buildRecomendacao({ ...point, colheita: 'meio' }, 'pt'))) {
  const farm: FarmService = { talhao: vi.fn(), recomendacao: vi.fn(load) }
  return { farm }
}

describe('useOptionsController (tela 6)', () => {
  it('lista as opções na ordem padrão (nota final), com a melhor na frente', async () => {
    const d = deps()
    const { result } = renderHook(() => useOptionsController(d), { wrapper: providers(`/opcoes?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.axis).toBeNull()
    expect(result.current.summary?.options[0].id).toBe('milho_braquiaria')
  })

  it('escolher um eixo reordena; tocar de novo volta à ordem padrão', async () => {
    const d = deps()
    const { result } = renderHook(() => useOptionsController(d), { wrapper: providers(`/opcoes?${flow}`) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.chooseAxis('dinheiro'))
    const margins = result.current.summary!.options.map((o) => o.dinheiro.margem_ha)
    expect(margins).toEqual([...margins].sort((a, b) => b - a))

    act(() => result.current.chooseAxis(null))
    expect(result.current.axis).toBeNull()
    expect(result.current.summary?.options[0].id).toBe('milho_braquiaria')
  })

  it('com colheita tardia, traz o aviso do que ficou fora da janela', async () => {
    const d = deps(() => Promise.resolve(buildRecomendacao({ ...point, colheita: 'tarde' }, 'pt')))
    const { result } = renderHook(() => useOptionsController(d), {
      wrapper: providers('/opcoes?lat=-18.9543&lon=-48.1993&colheita=tarde'),
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.summary?.late.names).toEqual(['Milho sozinho'])
  })

  it('as abas marcam "Todas as opções"', () => {
    const d = deps()
    const { result } = renderHook(() => useOptionsController(d), { wrapper: providers(`/opcoes?${flow}`) })

    expect(result.current.nav.tabs[2]).toMatchObject({ label: 'Todas as opções', current: true })
  })

  it('sem colheita volta para a pergunta 2', () => {
    const d = deps()
    const { result } = renderHook(() => useOptionsController(d), {
      wrapper: providers('/opcoes?lat=-18.9543&lon=-48.1993'),
    })

    expect(result.current.redirectTo).toBe('/quando?lat=-18.9543&lon=-48.1993')
  })
})
