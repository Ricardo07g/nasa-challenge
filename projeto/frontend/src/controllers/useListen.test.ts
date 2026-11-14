import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SpeechService } from '../services/speechService'
import { useListen } from './useListen'

function fakeSpeech(supported = true) {
  let onEnd: () => void = () => {}
  const service: SpeechService = {
    isSupported: () => supported,
    speak: vi.fn((_text: string, _lang: 'pt' | 'en', end: () => void) => {
      onEnd = end
    }),
    stop: vi.fn(),
  }
  return { service, finish: () => onEnd() }
}

describe('useListen', () => {
  it('começa a falar o texto da tela e depois para', () => {
    const { service } = fakeSpeech()
    const getText = () => 'Texto da tela'

    const { result } = renderHook(() => useListen('pt', getText, service))

    act(() => result.current.toggle())
    expect(service.speak).toHaveBeenCalledWith('Texto da tela', 'pt', expect.any(Function))
    expect(result.current.speaking).toBe(true)

    act(() => result.current.toggle())
    expect(service.stop).toHaveBeenCalled()
    expect(result.current.speaking).toBe(false)
  })

  it('volta ao normal quando a fala termina sozinha', () => {
    const { service, finish } = fakeSpeech()

    const { result } = renderHook(() => useListen('en', () => 'Hi', service))
    act(() => result.current.toggle())
    act(() => finish())

    expect(result.current.speaking).toBe(false)
  })

  it('informa quando o navegador não suporta', () => {
    const { service } = fakeSpeech(false)

    const { result } = renderHook(() => useListen('pt', () => '', service))

    expect(result.current.supported).toBe(false)
  })
})
