import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedRequest } from './useDebouncedRequest'

type Call = { key: string; signal: AbortSignal; resolve: (value: string) => void; reject: (error: unknown) => void }

/** `load` falso: guarda cada pedido para o teste decidir quando (e se) ele responde. */
function fakeLoad() {
  const calls: Call[] = []
  const load = vi.fn(
    (key: string, signal: AbortSignal) =>
      new Promise<string>((resolve, reject) => {
        calls.push({ key, signal, resolve, reject })
      }),
  )
  return { calls, load }
}

function setup(initialKey: string | null) {
  const fake = fakeLoad()
  const hook = renderHook(
    ({ key }: { key: string | null }) => useDebouncedRequest(key, (signal) => fake.load(key ?? '', signal), 400),
    { initialProps: { key: initialKey } },
  )
  return { ...fake, ...hook }
}

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms))

describe('useDebouncedRequest (espera entre teclas e um pedido por vez)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('sem chave, não pede nada', async () => {
    const { result, load } = setup(null)

    await wait(1000)

    expect(load).not.toHaveBeenCalled()
    expect(result.current).toEqual({ status: 'idle', data: undefined })
  })

  it('espera 400 ms sem mudança antes de pedir, e mostra a resposta', async () => {
    const { result, load, calls } = setup('uberaba')

    expect(result.current.status).toBe('loading')
    await wait(399)
    expect(load).not.toHaveBeenCalled()
    await wait(1)
    expect(load).toHaveBeenCalledTimes(1)

    await act(async () => calls[0].resolve('Uberaba, Minas Gerais'))

    expect(result.current).toEqual({ status: 'ready', data: 'Uberaba, Minas Gerais' })
  })

  it('digitando rápido, só pede a última palavra', async () => {
    const { rerender, load } = setup('ube')

    await wait(200)
    rerender({ key: 'uber' })
    await wait(200)
    rerender({ key: 'uberaba' })
    await wait(400)

    expect(load).toHaveBeenCalledTimes(1)
    expect(load.mock.calls[0][0]).toBe('uberaba')
  })

  it('pedido novo cancela o anterior, e a resposta atrasada do anterior é ignorada', async () => {
    const { result, rerender, calls } = setup('uberlandia')

    await wait(400)
    rerender({ key: 'uberaba' })

    expect(calls[0].signal.aborted).toBe(true)
    expect(result.current.status).toBe('loading')

    await wait(400)
    await act(async () => calls[0].resolve('velha'))
    await act(async () => calls[1].resolve('nova'))

    expect(result.current).toEqual({ status: 'ready', data: 'nova' })
  })

  it('erro de verdade vira "error"; o cancelamento não', async () => {
    const { result, rerender, calls } = setup('a1')

    await wait(400)
    rerender({ key: 'a2' })
    await act(async () => calls[0].reject(new DOMException('cancelado', 'AbortError')))
    expect(result.current.status).toBe('loading')

    await wait(400)
    await act(async () => calls[1].reject(new Error('429')))

    expect(result.current).toEqual({ status: 'error', data: undefined })
  })

  it('ao sair da tela, cancela o pedido em andamento', async () => {
    const { unmount, calls } = setup('uberaba')

    await wait(400)
    unmount()

    expect(calls[0].signal.aborted).toBe(true)
  })
})
