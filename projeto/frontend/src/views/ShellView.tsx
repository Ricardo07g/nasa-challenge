import type { ReactNode } from 'react'
import type { CreditsState } from '../controllers/useShellController'
import { DemoBanner } from '../design-system/components/Feedback'
import { AppFooter, type AppFooterProps } from '../design-system/components/Footer'
import { AppHeader, type AppHeaderProps } from '../design-system/components/Header'
import { CreditsModal } from './CreditsModal'
import styles from './ShellView.module.css'

type ShellViewProps = {
  header: AppHeaderProps
  footer: AppFooterProps
  /** Modal global "Créditos e uso de IA", aberto pelo rodapé de todas as telas. */
  credits: CreditsState
  /** Aviso fixo do modo de demonstração (dados de exemplo); null com a API real. */
  demoNotice?: string | null
  children: ReactNode
}

/**
 * Moldura comum a todas as telas: aviso de demonstração (só no modo mock), cabeçalho, conteúdo, rodapé e o
 * modal global de créditos.
 */
export function ShellView({ header, footer, credits, demoNotice = null, children }: ShellViewProps) {
  return (
    <div className={styles.shell}>
      {demoNotice && <DemoBanner>{demoNotice}</DemoBanner>}
      <AppHeader {...header} />
      <main id="conteudo" className={styles.main}>
        {children}
      </main>
      <AppFooter {...footer} />
      <CreditsModal
        open={credits.open}
        onClose={credits.onClose}
        content={credits.content}
        closeLabel={credits.closeLabel}
      />
    </div>
  )
}
