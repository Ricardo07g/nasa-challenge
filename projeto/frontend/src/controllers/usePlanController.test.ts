import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../repositories/httpClient'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { usePlanController } from './usePlanController'

const flow = 'lat=-18.9543&lon=-48.1993&colheita=meio'

function deps() {
  const farm: FarmService = {
    talhao: vi.fn(),
    recomendacao: vi.fn(() => Promise.resolve(buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt'))),
  }
  return { farm }
}

describe('usePlanController (tela 7)', () => {
  it('começa no ano normal e com 50 ha', async () => {
    const d = deps()
    const { result } = renderHook(() => usePlanController(d), { wrapper: providers(`/plano?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.scenario).toBe('normal')
    expect(result.current.area).toBe('50')
    expect(result.current.plan?.years.map((y) => y.crop)).toEqual(['milho_braquiaria', 'crotalaria', 'sorgo'])
  })

  it('"Ano seco" troca o plano e mostra de onde veio a troca', async () => {
    const d = deps()
    const { result } = renderHook(() => usePlanController(d), { wrapper: providers(`/plano?${flow}`) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.chooseScenario('seco'))

    expect(result.current.plan?.years[0]).toEqual({ year: 2027, crop: 'sorgo', swappedFrom: 'milho_braquiaria' })
  })

  it('"Comece por um pedaço" troca a área', async () => {
    const d = deps()
    const { result } = renderHook(() => usePlanController(d), { wrapper: providers(`/plano?${flow}`) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.chooseArea('all'))

    expect(result.current.area).toBe('all')
  })

  it('escolher "nenhum" (null) não desmarca o cenário nem a área', async () => {
    const d = deps()
    const { result } = renderHook(() => usePlanController(d), { wrapper: providers(`/plano?${flow}`) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.chooseScenario(null))
    act(() => result.current.chooseArea(null))

    expect(result.current.scenario).toBe('normal')
    expect(result.current.area).toBe('50')
  })

  it('as abas marcam "Plano de 3 anos"; sem colheita volta à pergunta 2', () => {
    const d = deps()
    const plan = renderHook(() => usePlanController(d), { wrapper: providers(`/plano?${flow}`) })
    const noHarvest = renderHook(() => usePlanController(d), {
      wrapper: providers('/plano?lat=-18.9543&lon=-48.1993'),
    })

    expect(plan.result.current.nav.tabs[1]).toMatchObject({ label: 'Plano de 3 anos', current: true })
    expect(noHarvest.result.current.redirectTo).toBe('/quando?lat=-18.9543&lon=-48.1993')
  })

  it('ponto sem dados no servidor vira o estado "fora da área"', async () => {
    const d = { farm: { talhao: vi.fn(), recomendacao: vi.fn(() => Promise.reject(new ApiError('/api/recomendacao', 404, 'OUTSIDE_AREA'))) } }
    const { result } = renderHook(() => usePlanController(d), { wrapper: providers(`/plano?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('outside'))
  })
})
