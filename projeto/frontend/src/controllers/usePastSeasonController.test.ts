import { act, renderHook, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../repositories/httpClient'
import { createMockPastSeasonRepository } from '../repositories/pastSeasonRepository'
import type { PastSeasonService } from '../services/pastSeasonService'
import { providers } from '../test/providers'
import { usePastSeasonController } from './usePastSeasonController'
import type { TelegramService } from '../services/telegramService'

const telegram: TelegramService = { enabled: true, linkFor: () => 'https://t.me/BotDoTime?start=x' }
const flow = 'lat=-18.9543&lon=-48.1993&colheita=meio'
const repository = createMockPastSeasonRepository(0)

function deps(get: PastSeasonService['get'] = (point, year, lang) => repository.get(point, year, lang)) {
  return { pastSeason: { get: vi.fn(get) }, apiMode: 'mock' as const }
}

describe('usePastSeasonController (replay da safra passada, P4)', () => {
  it('começa em 2024 (ano seco) com o ponto da lavoura', async () => {
    const d = deps()
    const { result } = renderHook(() => usePastSeasonController(d), { wrapper: providers(`/safra-passada?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.year).toBe(2024)
    expect(result.current.season?.eventos.some((e) => e.tipo === 'aviso_veranico')).toBe(true)
    expect(result.current.sampleData).toBe(true)
    expect(d.pastSeason.get).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993 }, 2024, 'pt')
  })

  it('o ano vem da URL e escolher outro ano troca a URL', async () => {
    const d = deps()
    const { result } = renderHook(() => usePastSeasonController(d), {
      wrapper: providers(`/safra-passada?${flow}&ano=2023`),
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.year).toBe(2023)
    act(() => result.current.chooseYear(2024))
    expect(screen.getByTestId('location')).toHaveTextContent(`/safra-passada?${flow}&ano=2024`)
  })

  it('Voltar vai para o plano; sem ponto, para o mapa', () => {
    const d = deps()
    const past = renderHook(() => usePastSeasonController(d), { wrapper: providers(`/safra-passada?${flow}`) })
    const noPoint = renderHook(() => usePastSeasonController(d), { wrapper: providers('/safra-passada') })

    expect(past.result.current.backTo).toBe(`/plano?${flow}`)
    expect(noPoint.result.current.redirectTo).toBe('/onde')
  })

  it('ponto sem dados no servidor vira "fora da área"', async () => {
    const d = deps(() => Promise.reject(new ApiError('/api/safra-passada', 404, 'OUTSIDE_AREA')))
    const { result } = renderHook(() => usePastSeasonController(d), { wrapper: providers(`/safra-passada?${flow}`) })

    await waitFor(() => expect(result.current.status).toBe('outside'))
  })

  it('link do Telegram para ativar os avisos, quando o bot está configurado (P5)', () => {
    const d = { ...deps(), telegram }
    const { result } = renderHook(() => usePastSeasonController(d), { wrapper: providers(`/safra-passada?${flow}`) })

    expect(result.current.telegramHref).toBe('https://t.me/BotDoTime?start=x')
  })
})
