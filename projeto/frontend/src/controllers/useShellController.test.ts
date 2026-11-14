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
    expect(result.current.header.slogan).toBe('Do espaço até a raiz.')
  })

  it('o link da Comunidade leva junto o ponto e a colheita que estão na URL', () => {
    const { result } = renderHook(() => useShellController(speech), {
      wrapper: providers('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio', 'pt'),
    })

    expect(result.current.header.community).toEqual({
      label: 'Comunidade',
      to: '/comunidade?lat=-18.9543&lon=-48.1993&colheita=meio',
    })
  })

  it('sem ponto na URL, a Comunidade abre sem parâmetros', () => {
    const { result } = renderHook(() => useShellController(speech), { wrapper: providers('/', 'pt') })

    expect(result.current.header.community.to).toBe('/comunidade')
  })

  it('monta o rodapé com o aviso, o caminho do agrônomo e o projeto', () => {
    const { result } = renderHook(() => useShellController(speech), { wrapper: providers('/', 'pt') })

    expect(result.current.footer).toEqual({
      disclaimer: 'Ajuda a decidir. Não substitui o seu agrônomo.',
      agronomist: 'Sou agrônomo(a): como a conta é feita',
      agronomistTo: '/como-funciona',
      project: 'NASA Space Apps Challenge 2026 · Field Shift',
    })
  })

  it('o link do agrônomo leva junto o caminho, para as notas serem da lavoura da pessoa', () => {
    const { result } = renderHook(() => useShellController(speech), {
      wrapper: providers('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio', 'pt'),
    })

    expect(result.current.footer.agronomistTo).toBe('/como-funciona?lat=-18.9543&lon=-48.1993&colheita=meio')
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
