import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { buildAvisos } from '../repositories/mocks/mockAvisos'
import type { AvisosService } from '../services/avisosService'
import { providers } from '../test/providers'
import { useShellController } from './useShellController'

describe('useShellController', () => {
  it('monta o cabeçalho com os textos do idioma atual: só Guia, Avisos e o idioma (sem Comunidade e sem "Ouvir")', () => {
    const { result } = renderHook(() => useShellController(), { wrapper: providers('/', 'pt') })

    expect(result.current.header.slogan).toBe('Do espaço até a raiz.')
    expect(result.current.header.navLabel).toBe('Principal')
    expect(result.current.header.lang.current).toBe('pt')
    expect(Object.keys(result.current.header).sort()).toEqual(
      ['alerts', 'guide', 'homeLabel', 'lang', 'nameMeaning', 'navLabel', 'slogan'].sort(),
    )
  })

  it('na Início em inglês, o cabeçalho traz o slogan novo e explica o nome: Portuguese for “Orbital Root”', () => {
    const { result } = renderHook(() => useShellController(), { wrapper: providers('/', 'en') })

    expect(result.current.header.slogan).toBe('Eyes on the sky, roots in the ground.')
    expect(result.current.header.nameMeaning).toBe('Portuguese for “Orbital Root”')
  })

  it('em português, o nome não ganha explicação (já é português), nem na Início', () => {
    const { result } = renderHook(() => useShellController(), { wrapper: providers('/', 'pt') })

    expect(result.current.header.nameMeaning).toBeNull()
  })

  it('nas outras telas, nem em inglês o nome ganha explicação (só na Início)', () => {
    const { result } = renderHook(() => useShellController(), { wrapper: providers('/guia', 'en') })

    expect(result.current.header.slogan).toBe('Eyes on the sky, roots in the ground.')
    expect(result.current.header.nameMeaning).toBeNull()
  })

  it('o Guia (pacote 3) leva a /guia, de qualquer tela', () => {
    const { result } = renderHook(() => useShellController(), {
      wrapper: providers('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio', 'pt'),
    })

    expect(result.current.header.guide).toEqual({ label: 'Guia', to: '/guia' })
  })

  it('na Início, o rodapé tem o aviso, os créditos e o projeto, sem o link do agrônomo (a faixa fica na tela)', () => {
    const { result } = renderHook(() => useShellController(), { wrapper: providers('/', 'pt') })

    expect(result.current.footer).toMatchObject({
      disclaimer: 'Ajuda a decidir. Não substitui o seu agrônomo.',
      credits: { label: 'Créditos e uso de IA' },
      project: 'NASA Space Apps 2026 · Field Shift',
      method: null,
    })
  })

  it('nas telas internas, o rodapé tem "Como a conta é feita", que leva junto o caminho da lavoura', () => {
    const { result } = renderHook(() => useShellController(), {
      wrapper: providers('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio', 'pt'),
    })

    expect(result.current.footer.method).toEqual({
      label: 'Como a conta é feita',
      to: '/como-funciona?lat=-18.9543&lon=-48.1993&colheita=meio',
    })
  })

  it('"Créditos e uso de IA" abre o modal global de créditos e o fechar fecha', () => {
    const { result } = renderHook(() => useShellController(), { wrapper: providers('/onde', 'pt') })
    expect(result.current.credits.open).toBe(false)

    act(() => result.current.footer.credits.onOpen())
    expect(result.current.credits.open).toBe(true)
    expect(result.current.credits.content.title).toBe('Créditos e uso de IA')
    expect(result.current.credits.closeLabel).toBe('Fechar')

    act(() => result.current.credits.onClose())
    expect(result.current.credits.open).toBe(false)
  })

  it('troca o idioma pelo botão PT | EN, e os créditos acompanham', () => {
    const { result } = renderHook(() => useShellController(), { wrapper: providers('/', 'pt') })

    act(() => result.current.header.lang.onToggle())

    expect(result.current.header.lang.current).toBe('en')
    expect(result.current.header.guide.label).toBe('Guide')
    expect(result.current.footer.credits.label).toBe('Credits and use of AI')
    expect(result.current.credits.content.title).toBe('Credits and use of AI')
  })
})

describe('useShellController: modo dos dados', () => {
  it('com os dados de exemplo (VITE_API_MODE=mock), avisa em todas as telas que não são da NASA', () => {
    const { result } = renderHook(() => useShellController('mock'), { wrapper: providers('/', 'pt') })

    expect(result.current.demoNotice).toBe('Modo de demonstração: dados de exemplo, não são da NASA')
  })

  it('o aviso acompanha o idioma', () => {
    const { result } = renderHook(() => useShellController('mock'), { wrapper: providers('/', 'en') })

    expect(result.current.demoNotice).toBe('Demo mode: sample data, not from NASA')
  })

  it('com a API real, não há aviso de demonstração', () => {
    const { result } = renderHook(() => useShellController('http'), { wrapper: providers('/', 'pt') })

    expect(result.current.demoNotice).toBeNull()
  })
})

describe('useShellController: botão "Avisos" (tarefa 0046)', () => {
  function alerts(): AvisosService {
    return {
      get: vi.fn((point) => Promise.resolve(buildAvisos(point, 'pt'))),
      savedPoint: vi.fn(() => null),
      savePoint: vi.fn(),
    }
  }

  it('o botão fica ao lado do Guia, leva o ponto e mostra o número de avisos ativos', async () => {
    const avisos = alerts()
    const { result } = renderHook(() => useShellController('mock', avisos), {
      wrapper: providers('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio', 'pt'),
    })

    expect(result.current.header.alerts).toMatchObject({
      label: 'Avisos',
      to: '/avisos?lat=-18.9543&lon=-48.1993&colheita=meio',
    })
    await waitFor(() => expect(result.current.header.alerts?.count).toBe(2))
    expect(result.current.header.alerts?.countLabel).toBe('Avisos: 2 avisos ativos')
  })

  it('sem ponto, o botão aparece sem número', () => {
    const { result } = renderHook(() => useShellController('mock', alerts()), {
      wrapper: providers('/', 'en'),
    })

    expect(result.current.header.alerts).toEqual({ label: 'Alerts', to: '/avisos', count: null, countLabel: null })
  })
})
