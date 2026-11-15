import { useEffect, useRef, useState } from 'react'

export type DebouncedState<T> = { status: 'idle' | 'loading' | 'ready' | 'error'; data: T | undefined }

type Done<T> = { key: string; status: 'ready' | 'error'; data: T | undefined }

const IDLE = { status: 'idle', data: undefined } as const

/**
 * Pede `load` só depois de `delayMs` sem a `key` mudar e cancela o pedido anterior (um por vez):
 * o uso justo de serviço público, como o endereço aproximado do Photon (tarefa 0053). `key` null = nada a pedir.
 * A resposta de um pedido cancelado é ignorada; o cancelamento não conta como erro.
 */
export function useDebouncedRequest<T>(
  key: string | null,
  load: (signal: AbortSignal) => Promise<T>,
  delayMs: number,
): DebouncedState<T> {
  const loadRef = useRef(load)
  const [done, setDone] = useState<Done<T> | null>(null)

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    if (key === null) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      loadRef.current(controller.signal).then(
        (data) => !controller.signal.aborted && setDone({ key, status: 'ready', data }),
        () => !controller.signal.aborted && setDone({ key, status: 'error', data: undefined }),
      )
    }, delayMs)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [key, delayMs])

  if (key === null) return IDLE
  if (done?.key !== key) return { status: 'loading', data: undefined }
  return { status: done.status, data: done.data }
}
