import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Recomendacao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { ApiError } from '../repositories/httpClient'
import type { FarmService } from '../services/farmService'
import type { TelegramService } from '../services/telegramService'
import { providers } from '../test/providers'
import { useAnswerController } from './useAnswerController'

const flow = 'lat=-18.9543&lon=-48.1993&colheita=meio'
const telegram: TelegramService = { enabled: true, linkFor: () => 'https://t.me/BotDoTime?start=x' }
const sample = buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')
const talhao = {
  ponto: { lat: -18.9543, lon: -48.1993 },
  celula_id: '-190_-482',
  dentro_da_area: true,
  solo: { textura: 'argiloso', cad_mm: 60, fonte: 'soilgrids' },
  colheita_sugerida: { faixa: 'meio', fonte: 'padrao', anos_usados: 0 },
  historico: null,
  dados: [{ fonte: 'nasa_power', periodo: '2005-2024' }],
} as Talhao

function deps(
  load: () => Promise<Recomendacao> = () => Promise.resolve(sample),
  apiMode: 'mock' | 'http' = 'http',
  loadTalhao: () => Promise<Talhao> = () => Promise.resolve(talhao),
) {
  const farm: FarmService = { talhao: vi.fn(loadTalhao), recomendacao: vi.fn(load) }
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

  it('link do Telegram com a lavoura, quando o bot está configurado (P5)', () => {
    const d = { ...deps(), telegram }
    const { result } = renderHook(() => useAnswerController(d), { wrapper: providers(`/resposta?${flow}`) })

    expect(result.current.telegramHref).toBe('https://t.me/BotDoTime?start=x')
  })

  it('o período da chuva vem do talhão (dados[]), não de um ano fixo', async () => {
    const d = deps()
    const { result } = renderHook(() => useAnswerController(d), { wrapper: providers(`/resposta?${flow}`) })

    await waitFor(() => expect(result.current.rain?.period).toEqual({ start: '2005', end: '2024' }))
    expect(result.current.rain?.years).toBe(20)
    expect(d.farm.talhao).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, exemplo: false }, 'pt')
  })

  it('se o talhão falhar, a resposta continua e a chuva fica só com o número de anos', async () => {
    const d = deps(undefined, 'http', () => Promise.reject(new Error('rede')))
    const { result } = renderHook(() => useAnswerController(d), { wrapper: providers(`/resposta?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    await waitFor(() => expect(d.farm.talhao).toHaveBeenCalled())
    expect(result.current.rain).toEqual({ years: 20, period: null, skipped: 0 })
  })
})
