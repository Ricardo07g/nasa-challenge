import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

function mockMatchMedia(matches: boolean) {
  const listeners: ((event: { matches: boolean }) => void)[] = []
  const query = {
    matches,
    addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.push(listener),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => query))
  return (next: boolean) => listeners.forEach((listener) => listener({ matches: next }))
}

describe('usePrefersReducedMotion', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('segue a preferência do aparelho e muda junto', () => {
    const change = mockMatchMedia(true)
    const { result } = renderHook(() => usePrefersReducedMotion())

    expect(result.current).toBe(true)
    act(() => change(false))
    expect(result.current).toBe(false)
  })

  it('sem matchMedia (ambiente antigo), considera que pode animar', () => {
    vi.stubGlobal('matchMedia', undefined)
    const { result } = renderHook(() => usePrefersReducedMotion())

    expect(result.current).toBe(false)
  })
})
