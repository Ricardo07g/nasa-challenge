import { useCallback, useEffect, useState, type DependencyList } from 'react'

export type AsyncState<T> = {
  status: 'loading' | 'ready' | 'error'
  data: T | undefined
  /** O erro do último carregamento, para a tela saber o motivo (ex.: fora da área). */
  error: unknown
  retry: () => void
}

type State<T> = { status: AsyncState<T>['status']; data: T | undefined; error: unknown }

/** Carrega algo assíncrono (service) com estados de carregando/erro e "tentar de novo". */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<State<T>>({ status: 'loading', data: undefined, error: undefined })

  useEffect(() => {
    let active = true
    setState((current) => ({ status: 'loading', data: current.data, error: undefined }))
    load().then(
      (data) => active && setState({ status: 'ready', data, error: undefined }),
      (error: unknown) => active && setState({ status: 'error', data: undefined, error }),
    )
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps vêm de quem chama, como no useEffect
  }, [...deps, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return { ...state, retry }
}
