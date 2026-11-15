import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDesignSystemController } from './useDesignSystemController'

describe('useDesignSystemController (/design-system, seção Ambiente)', () => {
  it('mostra o modo dos dados, o status do backend e as opções da API real', async () => {
    const deps = {
      apiMode: 'mock' as const,
      healthService: { getApiStatus: vi.fn().mockResolvedValue('ok') },
      cropOptionService: {
        listOptions: vi.fn().mockResolvedValue([{ id: 'milheto', name: 'Milheto', role: 'Cobertura' }]),
      },
    }

    const { result } = renderHook(() => useDesignSystemController(deps))

    expect(result.current.apiMode).toBe('mock')
    expect(result.current.backend).toBe('carregando')
    await waitFor(() => expect(result.current.backend).toBe('ok'))
    await waitFor(() => expect(result.current.cropOptions).toHaveLength(1))
  })

  it('quando a API real falha, mostra o erro sem quebrar a página', async () => {
    const deps = {
      apiMode: 'http' as const,
      healthService: { getApiStatus: vi.fn().mockResolvedValue('fora do ar') },
      cropOptionService: { listOptions: vi.fn().mockRejectedValue(new Error('500')) },
    }

    const { result } = renderHook(() => useDesignSystemController(deps))

    await waitFor(() => expect(result.current.backend).toBe('fora do ar'))
    await waitFor(() => expect(result.current.cropOptionsError).toBe(true))
  })
})

describe('useDesignSystemController (seção "Pacote 2": peças compartilhadas)', () => {
  const deps = {
    apiMode: 'mock' as const,
    healthService: { getApiStatus: vi.fn().mockResolvedValue('ok') },
    cropOptionService: { listOptions: vi.fn().mockResolvedValue([]) },
  }

  it('o formulário das safras guarda as respostas e a escolha atual', async () => {
    const { result } = renderHook(() => useDesignSystemController(deps))
    await waitFor(() => expect(result.current.backend).toBe('ok'))

    act(() => result.current.pacote2.onAnswer(2024, 'sorgo'))
    act(() => result.current.pacote2.current.onChoose('nao_sei'))

    expect(result.current.pacote2.answers).toEqual({ 2024: 'sorgo' })
    expect(result.current.pacote2.current.choice).toBe('nao_sei')
  })

  it('abre e fecha o modal grande e o "Preencher agora"', async () => {
    const { result } = renderHook(() => useDesignSystemController(deps))
    await waitFor(() => expect(result.current.backend).toBe('ok'))

    act(() => result.current.pacote2.openLarge())
    expect(result.current.pacote2.modal).toBe('large')
    act(() => result.current.pacote2.openSeasons())
    expect(result.current.pacote2.modal).toBe('seasons')
    act(() => result.current.pacote2.closeModal())
    expect(result.current.pacote2.modal).toBeNull()
  })
})
