import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function current(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches
}

/** A pessoa pediu menos movimento no aparelho? (a missão vira uma lista simples, RF-19) */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(current)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(QUERY)
    const onChange = (event: { matches: boolean }) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
