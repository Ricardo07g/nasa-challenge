import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SpeechService } from '../services/speechService'
import { providers } from '../test/providers'
import { useCommunitySoonController } from './useCommunitySoonController'

function speech(): SpeechService {
  return { isSupported: vi.fn(() => true), speak: vi.fn(), stop: vi.fn() }
}

describe('useCommunitySoonController (comunidade "em breve", tarefa 0061)', () => {
  it('o "Abrir o Guia" leva a /guia', () => {
    const { result } = renderHook(() => useCommunitySoonController(), { wrapper: providers('/comunidade', 'pt') })

    expect(result.current.guideTo).toBe('/guia')
  })

  it('sem o caminho da lavoura na URL, o Voltar vai para a Início', () => {
    const { result } = renderHook(() => useCommunitySoonController(), { wrapper: providers('/comunidade', 'pt') })

    expect(result.current.backTo).toBe('/')
  })

  it('link antigo com o caminho da lavoura: o Voltar vai para a resposta com o mesmo caminho', () => {
    const { result } = renderHook(() => useCommunitySoonController(), {
      wrapper: providers('/comunidade?lat=-18.9543&lon=-48.1993&colheita=meio', 'pt'),
    })

    expect(result.current.backTo).toBe('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')
  })

  it('o "Ouvir resumo" fala só o resumo da tela, em pt', () => {
    const voice = speech()
    const { result } = renderHook(() => useCommunitySoonController({ speech: voice }), {
      wrapper: providers('/comunidade', 'pt'),
    })

    act(() => result.current.listen.toggle())

    expect(voice.speak).toHaveBeenCalledWith(
      'A comunidade da sua região chega em breve, para acompanhar com os vizinhos o que cada um plantou e quanto choveu. Enquanto isso, o Guia explica cada cultura, o plantio e o clima.',
      'pt',
      expect.any(Function),
    )
  })

  it('e em inglês', () => {
    const voice = speech()
    const { result } = renderHook(() => useCommunitySoonController({ speech: voice }), {
      wrapper: providers('/comunidade', 'en'),
    })

    act(() => result.current.listen.toggle())

    expect(voice.speak).toHaveBeenCalledWith(
      "Your region's community is coming soon, to follow with your neighbors what each one planted and how much it rained. Meanwhile, the Guide explains each crop, planting and climate.",
      'en',
      expect.any(Function),
    )
  })
})
