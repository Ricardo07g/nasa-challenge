import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * Largura real do elemento, em px (ResizeObserver), para os gráficos desenharem na largura do espaço: o
 * texto fica do tamanho certo no celular, sem encolher junto com o desenho (tela 2, tarefa 0057). Sem
 * medida (jsdom, navegador antigo), fica a largura de reserva.
 */
export function useElementWidth<T extends Element>(fallback: number): [RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const measured = Math.round(entries[0]?.contentRect.width ?? 0)
      if (measured > 0) setWidth(measured)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width]
}
