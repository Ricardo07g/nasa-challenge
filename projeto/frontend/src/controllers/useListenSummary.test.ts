import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Lang } from '../i18n/language'
import type { SpeechService } from '../services/speechService'
import { useListenSummary } from './useListenSummary'

/** Fala falsa: guarda o aviso de fim de cada fala, para o teste decidir quando ela termina. */
function fakeSpeech(supported = true) {
  const ends: Array<() => void> = []
  const service: SpeechService = {
    isSupported: () => supported,
    speak: vi.fn((_text: string, _lang: Lang, end: () => void) => {
      ends.push(end)
    }),
    stop: vi.fn(),
  }
  return { service, ends }
}

const SUMMARY = 'O Raiz Orbital ajuda a decidir o que plantar depois da soja.'

describe('useListenSummary ("Ouvir resumo")', () => {
  it('fala só o resumo da tela, no idioma atual, e para quando tocado de novo', () => {
    const { service } = fakeSpeech()
    const { result } = renderHook(() => useListenSummary(SUMMARY, 'pt', service))

    act(() => result.current.toggle())
    expect(service.speak).toHaveBeenCalledWith(SUMMARY, 'pt', expect.any(Function))
    expect(result.current.speaking).toBe(true)

    act(() => result.current.toggle())
    expect(service.stop).toHaveBeenCalled()
    expect(result.current.speaking).toBe(false)
  })

  it('volta ao normal quando a fala termina sozinha', () => {
    const { service, ends } = fakeSpeech()
    const { result } = renderHook(() => useListenSummary(SUMMARY, 'en', service))

    act(() => result.current.toggle())
    act(() => ends[0]())

    expect(result.current.speaking).toBe(false)
  })

  it('o fim de uma fala antiga não desliga a fala nova', () => {
    const { service, ends } = fakeSpeech()
    const { result } = renderHook(() => useListenSummary(SUMMARY, 'pt', service))

    act(() => result.current.toggle())
    act(() => result.current.toggle())
    act(() => result.current.toggle())
    act(() => ends[0]())

    expect(result.current.speaking).toBe(true)
  })

  it('trocar o idioma interrompe a fala', () => {
    const { service } = fakeSpeech()
    const { result, rerender } = renderHook(({ lang }) => useListenSummary(SUMMARY, lang, service), {
      initialProps: { lang: 'pt' as Lang },
    })
    act(() => result.current.toggle())
    vi.mocked(service.stop).mockClear()

    rerender({ lang: 'en' })

    expect(service.stop).toHaveBeenCalled()
    expect(result.current.speaking).toBe(false)
  })

  it('sair da tela interrompe a fala', () => {
    const { service } = fakeSpeech()
    const { result, unmount } = renderHook(() => useListenSummary(SUMMARY, 'pt', service))
    act(() => result.current.toggle())
    vi.mocked(service.stop).mockClear()

    unmount()

    expect(service.stop).toHaveBeenCalled()
  })

  it('informa quando o navegador não tem voz', () => {
    const { service } = fakeSpeech(false)
    const { result } = renderHook(() => useListenSummary(SUMMARY, 'pt', service))

    expect(result.current.supported).toBe(false)
  })
})
