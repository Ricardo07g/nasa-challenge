import { Link, NavLink } from 'react-router'
import { AlertsIcon, CommunityIcon, LogoMark, SendIcon, SpeakerIcon, StopIcon } from '../icons'
import styles from './Header.module.css'

export type AppHeaderProps = {
  homeLabel: string
  slogan: string
  /** Link do topo para a Comunidade (leva junto o ponto da lavoura, se houver). */
  community: { label: string; to: string }
  /**
   * Tela "Avisos" (tarefa 0046): ao lado da Comunidade, com o número de avisos ativos em texto
   * (`countLabel` vira o nome acessível). Sem ponto ou sem aviso, `count` é null e o botão fica sem número.
   */
  alerts?: { label: string; to: string; count: number | null; countLabel: string | null }
  /** P5: link do bot do Telegram (só quando configurado). */
  telegram?: { href: string; label: string }
  listen: {
    supported: boolean
    speaking: boolean
    onToggle: () => void
    label: string
    stopLabel: string
    text: string
    stopText: string
  }
  lang: {
    current: 'pt' | 'en'
    onToggle: () => void
    label: string
  }
}

export function AppHeader({ homeLabel, slogan, community, alerts, telegram, listen, lang }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo} aria-label={homeLabel}>
          <LogoMark />
          <span className={styles.brand} aria-hidden="true">
            <span className={styles.brandName}>Raiz Orbital</span>
            <span className={styles.slogan}>{slogan}</span>
          </span>
        </Link>
        <div className={styles.actions}>
          <NavLink to={community.to} className={styles.community} aria-label={community.label}>
            <CommunityIcon />
            <span className={styles.communityText}>{community.label}</span>
          </NavLink>
          {alerts && (
            <NavLink
              to={alerts.to}
              className={styles.community}
              aria-label={alerts.count !== null && alerts.countLabel ? alerts.countLabel : alerts.label}
            >
              <AlertsIcon />
              <span className={styles.communityText}>{alerts.label}</span>
              {alerts.count !== null && (
                <span className={styles.alertsCount} aria-hidden="true">
                  {alerts.count}
                </span>
              )}
            </NavLink>
          )}
          {telegram && (
            <a
              href={telegram.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.community} ${styles.telegram}`}
              aria-label={telegram.label}
            >
              <SendIcon />
              <span className={styles.communityText}>Telegram</span>
            </a>
          )}
          {listen.supported && (
            <button
              type="button"
              className={styles.listen}
              aria-label={listen.speaking ? listen.stopLabel : listen.label}
              aria-pressed={listen.speaking}
              onClick={listen.onToggle}
            >
              {listen.speaking ? <StopIcon /> : <SpeakerIcon />}
              <span className={styles.listenText}>{listen.speaking ? listen.stopText : listen.text}</span>
            </button>
          )}
          <button type="button" className={styles.lang} aria-label={lang.label} onClick={lang.onToggle}>
            <span data-active={lang.current === 'pt'}>PT</span>
            <span className={styles.divider} aria-hidden="true">
              |
            </span>
            <span data-active={lang.current === 'en'}>EN</span>
          </button>
        </div>
      </div>
    </header>
  )
}
