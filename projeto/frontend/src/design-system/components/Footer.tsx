import { Link } from 'react-router'
import { ArrowUpRightIcon, ShieldIcon } from '../icons'
import styles from './Footer.module.css'

export type AppFooterProps = {
  disclaimer: string
  /** "Créditos e uso de IA": abre o modal global de créditos (regra do NASA Space Apps). */
  credits: { label: string; onOpen: () => void }
  project: string
  /**
   * Telas internas: "Como a conta é feita ↗" (leva junto o caminho da URL). Na Início é null: lá a faixa
   * grande do agrônomo, logo acima do rodapé, já leva para a mesma tela.
   */
  method: { label: string; to: string } | null
}

/**
 * Rodapé global (remodelagem, tarefa 0052), uma linha só: o escudo com o aviso à esquerda; à direita, o
 * link "Como a conta é feita" (só nas telas internas), "Créditos e uso de IA" e o projeto.
 */
export function AppFooter({ disclaimer, credits, project, method }: AppFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.disclaimer}>
          <ShieldIcon size={18} />
          <span>{disclaimer}</span>
        </p>
        <div className={styles.right}>
          {method && (
            <Link to={method.to} className={styles.method}>
              {method.label}
              <ArrowUpRightIcon size={14} />
            </Link>
          )}
          <button type="button" className={styles.credits} aria-haspopup="dialog" onClick={credits.onOpen}>
            {credits.label}
          </button>
          <span className={styles.project}>{project}</span>
        </div>
      </div>
    </footer>
  )
}
