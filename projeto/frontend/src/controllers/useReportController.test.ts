import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../repositories/httpClient'
import { buildRecomendacao, buildTalhao } from '../repositories/mocks/fixtures'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { useReportController } from './useReportController'

const point = { lat: -18.9543, lon: -48.1993 }
const flow = 'lat=-18.9543&lon=-48.1993&colheita=meio'

function deps(overrides: Partial<FarmService> = {}) {
  const farm: FarmService = {
    talhao: vi.fn().mockResolvedValue(buildTalhao(point, 'pt')),
    recomendacao: vi.fn().mockResolvedValue(buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')),
    ...overrides,
  }
  return { farm, print: vi.fn(), today: () => new Date(2026, 10, 14) }
}

describe('useReportController (relatório para banco e seguro, P2)', () => {
  it('junta o talhão e a recomendação do caminho na URL', async () => {
    const d = deps()
    const { result } = renderHook(() => useReportController(d), { wrapper: providers(`/relatorio?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.talhao?.ponto).toEqual(point)
    expect(result.current.recomendacao?.melhor).toBe('milho_braquiaria')
    expect(result.current.today).toBe('2026-11-14')
    expect(result.current.example).toBe(true)
    expect(result.current.place).toBe('Uberlândia (MG)')
  })

  it('"Salvar em PDF" abre a impressão do navegador', async () => {
    const d = deps()
    const { result } = renderHook(() => useReportController(d), { wrapper: providers(`/relatorio?${flow}`) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.print())

    expect(d.print).toHaveBeenCalled()
  })

  it('outra lavoura não é a fazenda de exemplo', () => {
    const d = deps()
    const { result } = renderHook(() => useReportController(d), {
      wrapper: providers('/relatorio?lat=-19.1&lon=-48.3&colheita=meio'),
    })

    expect(result.current.example).toBe(false)
  })

  it('Voltar vai para a resposta; sem colheita volta para a pergunta 2', () => {
    const d = deps()
    const report = renderHook(() => useReportController(d), { wrapper: providers(`/relatorio?${flow}`) })
    const noHarvest = renderHook(() => useReportController(d), {
      wrapper: providers('/relatorio?lat=-18.9543&lon=-48.1993'),
    })

    expect(report.result.current.backTo).toBe(`/resposta?${flow}`)
    expect(noHarvest.result.current.redirectTo).toBe('/quando?lat=-18.9543&lon=-48.1993')
  })

  it('ponto sem dados no servidor vira "fora da área"', async () => {
    const d = deps({ recomendacao: vi.fn().mockRejectedValue(new ApiError('/api/recomendacao', 404, 'OUTSIDE_AREA')) })
    const { result } = renderHook(() => useReportController(d), { wrapper: providers(`/relatorio?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('outside'))
  })
})
