import type { ReactNode } from 'react'
import { DemoBanner } from '../design-system/components/Feedback'
import { AppFooter, type AppFooterProps } from '../design-system/components/Footer'
import { AppHeader, type AppHeaderProps } from '../design-system/components/Header'
import styles from './ShellView.module.css'

type ShellViewProps = {
  header: AppHeaderProps
  footer: AppFooterProps
  /** Aviso fixo do modo de demonstração (dados de exemplo); null com a API real. */
  demoNotice?: string | null
  children: ReactNode
}

/** Moldura comum a todas as telas: aviso de demonstração (só no modo mock), cabeçalho, conteúdo e rodapé. */
export function ShellView({ header, footer, demoNotice = null, children }: ShellViewProps) {
  return (
    <div className={styles.shell}>
      {demoNotice && <DemoBanner>{demoNotice}</DemoBanner>}
      <AppHeader {...header} />
      <main id="conteudo" className={styles.main}>
        {children}
      </main>
      <AppFooter {...footer} />
    </div>
  )
}
