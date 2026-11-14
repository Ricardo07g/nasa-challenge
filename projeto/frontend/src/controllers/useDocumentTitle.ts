import { useEffect } from 'react'

/** Título da aba por tela (ajuda quem usa leitor de tela e quem compartilha o link). */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · Raiz Orbital`
  }, [title])
}
