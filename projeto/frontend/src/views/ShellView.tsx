import type { ReactNode } from 'react'
import { AppHeader, type AppHeaderProps } from '../design-system/components/Header'
import styles from './ShellView.module.css'

type ShellViewProps = {
  header: AppHeaderProps
  notice?: string
  children: ReactNode
}

/** Moldura comum a todas as telas: cabeçalho, conteúdo principal e aviso de dados de exemplo. */
export function ShellView({ header, notice, children }: ShellViewProps) {
  return (
    <div className={styles.shell}>
      <AppHeader {...header} />
      <main id="conteudo" className={styles.main}>
        {children}
      </main>
      {notice && <p className={styles.notice}>{notice}</p>}
    </div>
  )
}
