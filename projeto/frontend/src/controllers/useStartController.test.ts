import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SpeechService } from '../services/speechService'
import { providers } from '../test/providers'
import { useStartController } from './useStartController'

const speech: SpeechService = { isSupported: () => true, speak: vi.fn(), stop: vi.fn() }

describe('useStartController (tela Início)', () => {
  it('o "Ouvir resumo" fala só o resumo da tela inicial, em português', () => {
    const openCredits = vi.fn()
    const { result } = renderHook(() => useStartController(openCredits, speech), { wrapper: providers('/', 'pt') })

    act(() => result.current.listen.toggle())

    expect(speech.speak).toHaveBeenCalledWith(
      'O Raiz Orbital ajuda a decidir o que plantar depois da soja, com 20 anos de dados de satélite da NASA. É só marcar a lavoura no mapa e dizer quando você colhe a soja. Em seguida, você vê a melhor opção para a sua terra.',
      'pt',
      expect.any(Function),
    )
    expect(result.current.listen.speaking).toBe(true)
  })

  it('em inglês, fala o resumo em inglês', () => {
    const openCredits = vi.fn()
    const { result } = renderHook(() => useStartController(openCredits, speech), { wrapper: providers('/', 'en') })

    act(() => result.current.listen.toggle())

    expect(speech.speak).toHaveBeenCalledWith(
      'Raiz Orbital helps you decide what to plant after soybeans, using 20 years of NASA satellite data. Just mark your field on the map and tell us when you harvest your soybeans. Then you see the best option for your land.',
      'en',
      expect.any(Function),
    )
  })

  it('o selo "Dados da NASA" abre e fecha o modal "De onde vêm os dados"', () => {
    const openCredits = vi.fn()
    const { result } = renderHook(() => useStartController(openCredits, speech), { wrapper: providers('/', 'pt') })
    expect(result.current.sources.open).toBe(false)

    act(() => result.current.sources.onOpen())
    expect(result.current.sources.open).toBe(true)

    act(() => result.current.sources.onClose())
    expect(result.current.sources.open).toBe(false)
  })

  it('"Todas as fontes e créditos" fecha este modal e abre o de créditos', () => {
    const openCredits = vi.fn()
    const { result } = renderHook(() => useStartController(openCredits, speech), { wrapper: providers('/', 'pt') })
    act(() => result.current.sources.onOpen())

    act(() => result.current.sources.onAllCredits())

    expect(result.current.sources.open).toBe(false)
    expect(openCredits).toHaveBeenCalledTimes(1)
  })
})
