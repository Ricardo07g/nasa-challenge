import type { ReactNode } from 'react'
import { AppHeader, type AppHeaderProps } from '../design-system/components/Header'
import styles from './ShellView.module.css'

type ShellViewProps = {
  header: AppHeaderProps
  children: ReactNode
}

/** Moldura comum a todas as telas (protótipo v3): cabeçalho e conteúdo principal. Sem rodapé. */
export function ShellView({ header, children }: ShellViewProps) {
  return (
    <div className={styles.shell}>
      <AppHeader {...header} />
      <main id="conteudo" className={styles.main}>
        {children}
      </main>
    </div>
  )
}
