import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Recomendacao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { ApiError } from '../repositories/httpClient'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { useOptionsController } from './useOptionsController'

const flow = 'lat=-18.9543&lon=-48.1993&colheita=meio'
const point = { lat: -18.9543, lon: -48.1993 }
const talhao = {
  ponto: { lat: -18.9543, lon: -48.1993 },
  celula_id: '-190_-482',
  dentro_da_area: true,
  solo: { textura: 'argiloso', cad_mm: 60, fonte: 'soilgrids' },
  colheita_sugerida: { faixa: 'meio', fonte: 'padrao', anos_usados: 0 },
  historico: null,
  dados: [{ fonte: 'nasa_power', periodo: '2005-2024' }],
} as Talhao

function deps(load: () => Promise<Recomendacao> = () => Promise.resolve(buildRecomendacao({ ...point, colheita: 'meio' }, 'pt'))) {
  const farm: FarmService = { talhao: vi.fn(() => Promise.resolve(talhao)), recomendacao: vi.fn(load) }
  return { farm }
}

describe('useOptionsController (aba Comparar)', () => {
  it('lista as opções na ordem do equilíbrio (nota final), com a melhor na frente', async () => {
    const d = deps()
    const { result } = renderHook(() => useOptionsController(d), { wrapper: providers(`/opcoes?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.nav.objective).toBeNull()
    expect(result.current.summary?.options[0].id).toBe('milho_braquiaria')
  })

  it('o objetivo do produtor reordena (tarefa 0044); tocar de novo volta ao equilíbrio', async () => {
    const d = deps()
    const { result } = renderHook(() => useOptionsController(d), { wrapper: providers(`/opcoes?${flow}`) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    // Renda pela nota de renda do motor, sem reais (tarefa 0040)
    act(() => result.current.nav.chooseObjective('renda'))
    const incomes = result.current.summary!.options.map((o) => o.notas.renda)
    expect(incomes).toEqual([...incomes].sort((a, b) => b - a))
    expect(result.current.summary?.options[0].id).toBe('sorgo')

    act(() => result.current.nav.chooseObjective(null))
    expect(result.current.nav.objective).toBeNull()
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

  it('as abas marcam "Comparar"', () => {
    const d = deps()
    const { result } = renderHook(() => useOptionsController(d), { wrapper: providers(`/opcoes?${flow}`) })

    expect(result.current.nav.tabs[1]).toMatchObject({ label: 'Comparar', current: true })
  })

  it('sem colheita volta para a pergunta 2', () => {
    const d = deps()
    const { result } = renderHook(() => useOptionsController(d), {
      wrapper: providers('/opcoes?lat=-18.9543&lon=-48.1993'),
    })

    expect(result.current.redirectTo).toBe('/quando?lat=-18.9543&lon=-48.1993')
  })

  it('ponto sem dados no servidor vira o estado "fora da área"', async () => {
    const d = deps(() => Promise.reject(new ApiError('/api/recomendacao', 404, 'OUTSIDE_AREA')))
    const { result } = renderHook(() => useOptionsController(d), { wrapper: providers(`/opcoes?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('outside'))
  })

  it('o período da chuva vem do talhão (dados[]), para a legenda dos quadrinhos', async () => {
    const d = deps()
    const { result } = renderHook(() => useOptionsController(d), { wrapper: providers(`/opcoes?${flow}`) })

    await waitFor(() => expect(result.current.rain?.period).toEqual({ start: '2005', end: '2024' }))
    expect(result.current.rain?.years).toBe(20)
  })
})
