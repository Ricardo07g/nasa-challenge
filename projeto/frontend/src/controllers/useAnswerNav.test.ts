import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { providers } from '../test/providers'
import { useAnswerNav } from './useAnswerNav'

const query = '?lat=-18.9543&lon=-48.1993&colheita=meio'

describe('useAnswerNav', () => {
  it('monta as 3 abas mantendo o ponto na URL e marca a tela atual', () => {
    const { result } = renderHook(() => useAnswerNav(), { wrapper: providers(`/opcoes${query}`, 'pt') })

    expect(result.current.label).toBe('Telas da resposta')
    expect(result.current.tabs).toEqual([
      { to: `/resposta${query}`, label: 'Resposta', current: false },
      { to: `/plano${query}`, label: 'Plano de 3 anos', current: false },
      { to: `/opcoes${query}`, label: 'Todas as opções', current: true },
    ])
  })

  it('o Voltar das abas leva para a pergunta da colheita, com o ponto', () => {
    const { result } = renderHook(() => useAnswerNav(), { wrapper: providers(`/resposta${query}`, 'pt') })

    expect(result.current.backTo).toBe(`/quando${query}`)
  })

  it('em inglês', () => {
    const { result } = renderHook(() => useAnswerNav(), { wrapper: providers(`/resposta${query}`, 'en') })

    expect(result.current.tabs.map((tab) => tab.label)).toEqual(['Answer', '3-year plan', 'All options'])
  })
})
