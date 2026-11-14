import { useEffect } from 'react'

/** Título da aba por tela, no padrão do protótipo: "Raiz Orbital – Início". */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `Raiz Orbital – ${title}`
  }, [title])
}
