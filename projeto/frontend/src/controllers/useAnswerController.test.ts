import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Recomendacao } from '../models/recomendacao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { ApiError } from '../repositories/httpClient'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { useAnswerController } from './useAnswerController'

const flow = 'lat=-18.9543&lon=-48.1993&colheita=meio'
const sample = buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')

function deps(load: () => Promise<Recomendacao> = () => Promise.resolve(sample), apiMode: 'mock' | 'http' = 'http') {
  const farm: FarmService = { talhao: vi.fn(), recomendacao: vi.fn(load) }
  return { farm, apiMode }
}

describe('useAnswerController (tela 5)', () => {
  it('pede a recomendação com o caminho da URL e monta a resposta', async () => {
    const d = deps()
    const { result } = renderHook(() => useAnswerController(d), {
      wrapper: providers(`/resposta?${flow}&solo=argiloso`),
    })

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.answer?.best.id).toBe('milho_braquiaria')
    expect(result.current.answer?.year).toBe(2027)
    expect(result.current.aviso).toBe('Ajuda a decidir. Não substitui o agrônomo.')
    expect(d.farm.recomendacao).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, colheita: 'meio', solo: 'argiloso', exemplo: false },
      'pt',
    )
  })

  it('as abas marcam a Resposta e o Voltar vai para a pergunta 2', () => {
    const d = deps()
    const { result } = renderHook(() => useAnswerController(d), { wrapper: providers(`/resposta?${flow}`) })

    expect(result.current.nav.tabs[0]).toMatchObject({ label: 'Resposta', current: true })
    expect(result.current.nav.backTo).toBe(`/quando?${flow}`)
    expect(result.current.reportTo).toBe(`/relatorio?${flow}`)
  })

  it('com os dados de exemplo (sem o motor ligado), avisa que os valores são de exemplo', async () => {
    const d = deps(undefined, 'mock')
    const { result } = renderHook(() => useAnswerController(d), { wrapper: providers(`/resposta?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.sampleData).toBe(true)
  })

  it('se a recomendação não vier, mostra o erro e tenta de novo', async () => {
    let calls = 0
    const d = deps(() => (++calls === 1 ? Promise.reject(new Error('rede')) : Promise.resolve(sample)))
    const { result } = renderHook(() => useAnswerController(d), { wrapper: providers(`/resposta?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('error'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('resposta sem a melhor opção na lista conta como erro', async () => {
    const d = deps(() => Promise.resolve({ ...sample, melhor: 'pousio' }))
    const { result } = renderHook(() => useAnswerController(d), { wrapper: providers(`/resposta?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('error'))
  })

  it('sem ponto volta para o mapa; sem colheita volta para a pergunta 2', () => {
    const d = deps()
    const noPoint = renderHook(() => useAnswerController(d), { wrapper: providers('/resposta') })
    const noHarvest = renderHook(() => useAnswerController(d), {
      wrapper: providers('/resposta?lat=-18.9543&lon=-48.1993'),
    })

    expect(noPoint.result.current.redirectTo).toBe('/onde')
    expect(noHarvest.result.current.redirectTo).toBe('/quando?lat=-18.9543&lon=-48.1993')
  })

  it('ponto sem dados no servidor (404 OUTSIDE_AREA) vira o estado "fora da área"', async () => {
    const d = deps(() => Promise.reject(new ApiError('/api/recomendacao', 404, 'OUTSIDE_AREA')))
    const { result } = renderHook(() => useAnswerController(d), { wrapper: providers(`/resposta?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('outside'))
  })
})
