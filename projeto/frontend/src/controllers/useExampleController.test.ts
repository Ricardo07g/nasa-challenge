import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Talhao } from '../models/talhao'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { useExampleController } from './useExampleController'

/** Talhão de teste da fazenda de exemplo: só o que o controller lê. */
function farm(talhao: () => Promise<Talhao>): FarmService {
  return { talhao: vi.fn(talhao), recomendacao: vi.fn() }
}

describe('useExampleController ("Ver um exemplo pronto", tarefa 0049)', () => {
  it('abre a resposta do exemplo com a faixa do satélite, a mesma do /exemplo', async () => {
    const deps = { farm: farm(() => Promise.resolve({ colheita_sugerida: { faixa: 'tarde' } } as Talhao)) }
    const { result } = renderHook(() => useExampleController(deps), { wrapper: providers('/exemplo') })

    await waitFor(() => expect(result.current.to).not.toBeNull())
    expect(result.current.to).toBe('/resposta?lat=-18.9543&lon=-48.1993&colheita=tarde&exemplo=1')
    expect(deps.farm.talhao).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, exemplo: true }, 'pt')
  })

  it('enquanto carrega, ainda não vai a lugar nenhum', () => {
    const deps = { farm: farm(() => new Promise<Talhao>(() => {})) }
    const { result } = renderHook(() => useExampleController(deps), { wrapper: providers('/exemplo') })

    expect(result.current.to).toBeNull()
  })

  it('sem a faixa do satélite ou com falha, abre no meio de fevereiro (o padrão do motor)', async () => {
    const deps = { farm: farm(() => Promise.reject(new Error('fora do ar'))) }
    const { result } = renderHook(() => useExampleController(deps), { wrapper: providers('/exemplo') })

    await waitFor(() => expect(result.current.to).toBe('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio&exemplo=1'))
  })
})
