import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CropOption } from '../models/cropOption'
import { useHomeController } from './useHomeController'

const options: CropOption[] = [{ id: 'milheto', name: 'Milheto', role: 'Cobertura' }]

describe('useHomeController', () => {
  it('começa carregando e depois expõe status e opções', async () => {
    const deps = {
      healthService: { getApiStatus: vi.fn().mockResolvedValue('ok') },
      cropOptionService: { listOptions: vi.fn().mockResolvedValue(options) },
    }

    const { result } = renderHook(() => useHomeController(deps))

    expect(result.current.apiStatus).toBe('carregando')
    await waitFor(() => expect(result.current.apiStatus).toBe('ok'))
    expect(result.current.cropOptions).toEqual(options)
    expect(result.current.error).toBeNull()
  })

  it('expõe a mensagem de erro quando as opções falham', async () => {
    const deps = {
      healthService: { getApiStatus: vi.fn().mockResolvedValue('ok') },
      cropOptionService: { listOptions: vi.fn().mockRejectedValue(new Error('falhou')) },
    }

    const { result } = renderHook(() => useHomeController(deps))

    await waitFor(() => expect(result.current.error).toBe('falhou'))
    expect(result.current.cropOptions).toEqual([])
  })
})
