import { useCallback, useEffect, useState, type DependencyList } from 'react'

export type AsyncState<T> = {
  status: 'loading' | 'ready' | 'error'
  data: T | undefined
  retry: () => void
}

/** Carrega algo assíncrono (service) com estados de carregando/erro e "tentar de novo". */
export function useAsync<T>(load: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ status: AsyncState<T>['status']; data: T | undefined }>({
    status: 'loading',
    data: undefined,
  })

  useEffect(() => {
    let active = true
    setState((current) => ({ status: 'loading', data: current.data }))
    load().then(
      (data) => active && setState({ status: 'ready', data }),
      () => active && setState({ status: 'error', data: undefined }),
    )
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps vêm de quem chama, como no useEffect
  }, [...deps, attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return { ...state, retry }
}
