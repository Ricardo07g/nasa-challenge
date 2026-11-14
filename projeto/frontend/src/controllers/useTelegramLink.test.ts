import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { TelegramService } from '../services/telegramService'
import { providers } from '../test/providers'
import { useTelegramLink } from './useTelegramLink'

function fakeTelegram(enabled = true): TelegramService {
  return { enabled, linkFor: vi.fn(() => (enabled ? 'https://t.me/BotDoTime?start=x' : null)) }
}

describe('useTelegramLink (P5)', () => {
  it('sem o bot configurado, não há link', () => {
    const telegram = fakeTelegram(false)
    const { result } = renderHook(() => useTelegramLink(telegram), { wrapper: providers('/resposta?lat=-18.9543&lon=-48.1993') })

    expect(result.current).toBeNull()
  })

  it('com o caminho na URL, o link leva o ponto e a colheita da lavoura', () => {
    const telegram = fakeTelegram()
    const { result } = renderHook(() => useTelegramLink(telegram), {
      wrapper: providers('/resposta?lat=-18.9543&lon=-48.1993&colheita=cedo&solo=argiloso'),
    })

    expect(result.current).toBe('https://t.me/BotDoTime?start=x')
    expect(telegram.linkFor).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, colheita: 'cedo' })
  })

  it('sem ponto na URL, abre o bot sem lavoura', () => {
    const telegram = fakeTelegram()
    renderHook(() => useTelegramLink(telegram), { wrapper: providers('/') })

    expect(telegram.linkFor).toHaveBeenCalledWith(null)
  })
})
