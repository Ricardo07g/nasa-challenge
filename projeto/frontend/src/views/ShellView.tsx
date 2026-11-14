import type { ReactNode } from 'react'
import { AppFooter, type AppFooterProps } from '../design-system/components/Footer'
import { AppHeader, type AppHeaderProps } from '../design-system/components/Header'
import styles from './ShellView.module.css'

type ShellViewProps = {
  header: AppHeaderProps
  footer: AppFooterProps
  children: ReactNode
}

/** Moldura comum a todas as telas: cabeçalho, conteúdo principal e rodapé com o aviso. */
export function ShellView({ header, footer, children }: ShellViewProps) {
  return (
    <div className={styles.shell}>
      <AppHeader {...header} />
      <main id="conteudo" className={styles.main}>
        {children}
      </main>
      <AppFooter {...footer} />
    </div>
  )
}
