import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Recomendacao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import type { FarmService } from '../services/farmService'
import type { TelegramService } from '../services/telegramService'
import { providers } from '../test/providers'
import { useMethodController } from './useMethodController'

const telegram: TelegramService = { enabled: true, linkFor: () => 'https://t.me/BotDoTime?start=x' }
const sample = buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')
const talhao = {
  ponto: { lat: -18.9543, lon: -48.1993 },
  celula_id: '-190_-482',
  dentro_da_area: true,
  solo: { textura: 'argiloso', cad_mm: 60, fonte: 'soilgrids' },
  colheita_sugerida: null,
  historico: null,
  dados: [{ fonte: 'nasa_power', periodo: '2005-2024' }],
} as Talhao

function deps(
  load: () => Promise<Recomendacao> = () => Promise.resolve(sample),
  loadTalhao: () => Promise<Talhao> = () => Promise.resolve(talhao),
) {
  const farm: FarmService = { talhao: vi.fn(loadTalhao), recomendacao: vi.fn(load) }
  return { farm }
}

describe('useMethodController (tela 9)', () => {
  it('sem caminho na URL, as notas são da fazenda de exemplo (colheita no meio de fevereiro)', async () => {
    const d = deps()
    const { result } = renderHook(() => useMethodController(d), { wrapper: providers('/como-funciona') })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.example).toBe(true)
    expect(result.current.rows[0].id).toBe('milho_braquiaria')
    expect(d.farm.recomendacao).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, colheita: 'meio', exemplo: true },
      'pt',
    )
    expect(result.current.backTo).toBe('/')
  })

  it('com o caminho na URL, as notas são da lavoura da pessoa e o Voltar vai para a resposta', async () => {
    const d = deps()
    const { result } = renderHook(() => useMethodController(d), {
      wrapper: providers('/como-funciona?lat=-19.1&lon=-48.3&colheita=tarde'),
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.example).toBe(false)
    expect(d.farm.recomendacao).toHaveBeenCalledWith(
      { lat: -19.1, lon: -48.3, colheita: 'tarde', solo: undefined, exemplo: false },
      'pt',
    )
    expect(result.current.backTo).toBe('/resposta?lat=-19.1&lon=-48.3&colheita=tarde')
  })

  it('as safras confirmadas na tela 4 entram na conta mostrada (tarefa 0039)', async () => {
    const d = deps()
    const { result } = renderHook(() => useMethodController(d), {
      wrapper: providers('/como-funciona?lat=-19.1&lon=-48.3&colheita=tarde&confirmadas=2024:parado'),
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(d.farm.recomendacao).toHaveBeenCalledWith(
      { lat: -19.1, lon: -48.3, colheita: 'tarde', solo: undefined, exemplo: false, confirmadas: '2024:parado' },
      'pt',
    )
  })

  it('se as notas não vierem, mostra o erro e tenta de novo', async () => {
    let calls = 0
    const d = deps(() => (++calls === 1 ? Promise.reject(new Error('x')) : Promise.resolve(sample)))
    const { result } = renderHook(() => useMethodController(d), { wrapper: providers('/como-funciona') })

    await waitFor(() => expect(result.current.status).toBe('error'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.status).toBe('ready'))
  })

  it('link do Telegram, quando o bot está configurado (P5)', () => {
    const d = { ...deps(), telegram }
    const { result } = renderHook(() => useMethodController(d), { wrapper: providers('/como-funciona') })

    expect(result.current.telegramHref).toBe('https://t.me/BotDoTime?start=x')
  })

  it('de onde vem cada dado: quais fontes estão conectadas, pelo talhão (dados[], solo e histórico)', async () => {
    const d = deps()
    const { result } = renderHook(() => useMethodController(d), { wrapper: providers('/como-funciona') })

    await waitFor(() => expect(result.current.sources.status).toBe('ready'))
    expect(result.current.sources.rows.filter((row) => row.connected).map((row) => row.key)).toEqual([
      'nasa_power',
      'soilgrids',
    ])
    expect(result.current.sources.rainKm).toBe(50)
    expect(d.farm.talhao).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, exemplo: true }, 'pt')
  })

  it('com o caminho na URL, as fontes são do talhão da pessoa', async () => {
    const d = deps()
    const { result } = renderHook(() => useMethodController(d), {
      wrapper: providers('/como-funciona?lat=-19.1&lon=-48.3&colheita=tarde'),
    })

    await waitFor(() => expect(result.current.sources.status).toBe('ready'))
    expect(d.farm.talhao).toHaveBeenCalledWith({ lat: -19.1, lon: -48.3, exemplo: false }, 'pt')
  })

  it('o período da chuva do passo 1 vem do talhão e dos anos usados', async () => {
    const d = deps()
    const { result } = renderHook(() => useMethodController(d), { wrapper: providers('/como-funciona') })

    await waitFor(() => expect(result.current.rain?.period).toEqual({ start: '2005', end: '2024' }))
    expect(result.current.rain?.years).toBe(20)
  })

  it('se o talhão não vier, as fontes mostram o erro e tentam de novo', async () => {
    let calls = 0
    const d = deps(undefined, () => (++calls === 1 ? Promise.reject(new Error('x')) : Promise.resolve(talhao)))
    const { result } = renderHook(() => useMethodController(d), { wrapper: providers('/como-funciona') })

    await waitFor(() => expect(result.current.sources.status).toBe('error'))
    act(() => result.current.retrySources())
    await waitFor(() => expect(result.current.sources.status).toBe('ready'))
  })
})
