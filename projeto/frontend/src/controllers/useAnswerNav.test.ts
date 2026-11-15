import { act, renderHook } from '@testing-library/react'
import { useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { providers } from '../test/providers'
import { useAnswerNav } from './useAnswerNav'

const query = '?lat=-18.9543&lon=-48.1993&colheita=meio'

describe('useAnswerNav', () => {
  it('monta as 3 abas na ordem nova (Sugestão, Comparar, Plano), mantendo o ponto e marcando a atual', () => {
    const { result } = renderHook(() => useAnswerNav(), { wrapper: providers(`/opcoes${query}`, 'pt') })

    expect(result.current.label).toBe('Telas da resposta')
    expect(result.current.tabs).toEqual([
      { to: `/resposta${query}`, label: 'Sugestão', current: false },
      { to: `/opcoes${query}`, label: 'Comparar', current: true },
      { to: `/plano${query}`, label: 'Plano de 3 anos', current: false },
    ])
  })

  it('o Voltar das abas leva para a pergunta da colheita, com o ponto', () => {
    const { result } = renderHook(() => useAnswerNav(), { wrapper: providers(`/resposta${query}`, 'pt') })

    expect(result.current.backTo).toBe(`/quando${query}`)
  })

  it('em inglês', () => {
    const { result } = renderHook(() => useAnswerNav(), { wrapper: providers(`/resposta${query}`, 'en') })

    expect(result.current.tabs.map((tab) => tab.label)).toEqual(['Suggestion', 'Compare', '3-year plan'])
  })

  it('o objetivo do produtor vem da URL e segue nas três abas', () => {
    const { result } = renderHook(() => useAnswerNav(), { wrapper: providers(`/resposta${query}&objetivo=terra`, 'pt') })

    expect(result.current.objective).toBe('terra')
    expect(result.current.tabs.every((tab) => tab.to.endsWith('&objetivo=terra'))).toBe(true)
  })

  it('escolher o objetivo troca a URL sem sair da aba; tocar de novo volta ao equilíbrio', () => {
    const { result } = renderHook(
      () => ({ nav: useAnswerNav(), location: useLocation() }),
      { wrapper: providers(`/plano${query}`, 'pt') },
    )

    act(() => result.current.nav.chooseObjective('seguranca'))
    expect(result.current.location.pathname).toBe('/plano')
    expect(result.current.location.search).toBe(`${query}&objetivo=seguranca`)
    expect(result.current.nav.objective).toBe('seguranca')

    act(() => result.current.nav.chooseObjective(null))
    expect(result.current.location.search).toBe(query)
    expect(result.current.nav.objective).toBeNull()
  })
})
