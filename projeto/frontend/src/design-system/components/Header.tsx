import { Link, NavLink } from 'react-router'
import { AlertsIcon, BookIcon, LogoMark } from '../icons'
import { FlagBR, FlagUS } from '../flags/Flag'
import styles from './Header.module.css'

export type AppHeaderProps = {
  homeLabel: string
  slogan: string
  /**
   * Linha discreta logo abaixo do nome e acima do slogan (15/11/2026): o que o nome quer dizer, "Portuguese for
   * “Orbital Root”". Só na Início e só em inglês; `null` = a linha não aparece.
   */
  nameMeaning: string | null
  /** Nome da navegação ("Principal" / "Main"). */
  navLabel: string
  /**
   * Guia (pacote 3, tarefa 0061): pílula verde-clara com o livro e o nome escrito, também no celular. Em `/guia`
   * e nos artigos, fica marcada (`aria-current="page"`) e verde cheia.
   */
  guide: { label: string; to: string }
  /**
   * Avisos (tarefa 0046): sino, o nome e o selo laranja com o número de avisos ativos do último ponto
   * (`/api/avisos`); `countLabel` vira o nome acessível. Sem ponto ou sem aviso, `count` é null e o selo
   * não aparece. No celular, só o sino com o selo. Em `/avisos`, fica marcado (`aria-current="page"`) com o
   * fundo verde-claro.
   */
  alerts: { label: string; to: string; count: number | null; countLabel: string | null }
  /** "EN | PT" em destaque, cada um com a bandeirinha; no celular, só o outro idioma. */
  lang: {
    current: 'pt' | 'en'
    onToggle: () => void
    label: string
  }
}

/**
 * Cabeçalho global (remodelagem, tarefa 0052; pacote 3, tarefa 0061): logo, nome e slogan à esquerda; à direita,
 * só Guia, Avisos e o idioma. A Comunidade saiu (está "em breve"). O "Ouvir" não fica aqui: cada tela tem o seu
 * "Ouvir resumo" perto do título.
 */
export function AppHeader({ homeLabel, slogan, nameMeaning, navLabel, guide, alerts, lang }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo} aria-label={homeLabel}>
          <LogoMark size={44} />
          <span className={styles.brand} aria-hidden="true">
            <span className={styles.brandName}>Raiz Orbital</span>
            {nameMeaning && <span className={styles.nameMeaning}>{nameMeaning}</span>}
            <span className={styles.slogan}>{slogan}</span>
          </span>
        </Link>
        <nav className={styles.nav} aria-label={navLabel}>
          <NavLink to={guide.to} className={styles.guide} data-variant="pill">
            <BookIcon size={18} />
            <span>{guide.label}</span>
          </NavLink>
          <NavLink
            to={alerts.to}
            className={styles.alerts}
            aria-label={alerts.count !== null && alerts.countLabel ? alerts.countLabel : undefined}
          >
            <AlertsIcon size={18} />
            <span className={styles.alertsLabel}>{alerts.label}</span>
            {alerts.count !== null && (
              <span className={styles.badge} aria-hidden="true">
                {alerts.count}
              </span>
            )}
          </NavLink>
          <button type="button" className={styles.lang} data-highlight aria-label={lang.label} onClick={lang.onToggle}>
            <span data-lang="en" data-active={lang.current === 'en'}>
              <FlagUS width={18} />
              EN
            </span>
            <span className={styles.divider} aria-hidden="true">
              |
            </span>
            <span data-lang="pt" data-active={lang.current === 'pt'}>
              <FlagBR width={18} />
              PT
            </span>
          </button>
        </nav>
      </div>
    </header>
  )
}
