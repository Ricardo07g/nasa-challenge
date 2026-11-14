import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAsync } from './useAsync'

describe('useAsync', () => {
  it('começa carregando e entrega o resultado', async () => {
    const { result } = renderHook(() => useAsync(() => Promise.resolve(42), []))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.data).toBe(42)
  })

  it('mostra erro e tenta de novo', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce('ok')
    const { result } = renderHook(() => useAsync(load, []))

    await waitFor(() => expect(result.current.status).toBe('error'))
    act(() => result.current.retry())

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.data).toBe('ok')
  })

  it('recarrega quando as dependências mudam', async () => {
    const { result, rerender } = renderHook(({ id }) => useAsync(() => Promise.resolve(id), [id]), {
      initialProps: { id: 'pt' },
    })
    await waitFor(() => expect(result.current.data).toBe('pt'))

    rerender({ id: 'en' })

    await waitFor(() => expect(result.current.data).toBe('en'))
  })
})
