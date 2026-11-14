import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SpeechService } from '../services/speechService'
import { providers } from '../test/providers'
import { useShellController } from './useShellController'

const speech: SpeechService = { isSupported: () => true, speak: vi.fn(), stop: vi.fn() }

describe('useShellController', () => {
  it('monta o cabeçalho com os textos do idioma atual', () => {
    const { result } = renderHook(() => useShellController(speech), { wrapper: providers('/', 'pt') })

    expect(result.current.header.listen.text).toBe('Ouvir')
    expect(result.current.header.lang.current).toBe('pt')
  })

  it('troca o idioma pelo botão PT | EN', () => {
    const { result } = renderHook(() => useShellController(speech), { wrapper: providers('/', 'pt') })

    act(() => result.current.header.lang.onToggle())

    expect(result.current.header.lang.current).toBe('en')
    expect(result.current.header.listen.text).toBe('Listen')
  })

  it('o Ouvir lê o conteúdo principal da tela no idioma atual', () => {
    const main = document.createElement('main')
    main.textContent = 'O que plantar depois da soja?'
    document.body.append(main)
    const { result } = renderHook(() => useShellController(speech), { wrapper: providers('/', 'pt') })

    act(() => result.current.header.listen.onToggle())

    expect(speech.speak).toHaveBeenCalledWith('O que plantar depois da soja?', 'pt', expect.any(Function))
    main.remove()
  })
})
