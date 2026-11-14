import { Link } from 'react-router'
import { ArrowUpRightIcon, ShieldIcon } from '../icons'
import styles from './Footer.module.css'

export type AppFooterProps = {
  disclaimer: string
  agronomist: string
  /** Destino do link do agrônomo; leva junto o caminho da URL, se houver. */
  agronomistTo?: string
  project: string
}

/** Rodapé comum: o aviso de apoio à decisão, o caminho para o agrônomo e o projeto. */
export function AppFooter({ disclaimer, agronomist, agronomistTo = '/como-funciona', project }: AppFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.row}>
          <p className={styles.disclaimer}>
            <ShieldIcon size={18} />
            <span>{disclaimer}</span>
          </p>
          <Link to={agronomistTo} className={styles.link}>
            {agronomist} <ArrowUpRightIcon />
          </Link>
        </div>
        <p className={styles.project}>{project}</p>
      </div>
    </footer>
  )
}
