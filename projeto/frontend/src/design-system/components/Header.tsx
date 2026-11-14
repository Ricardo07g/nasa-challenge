import { Link, NavLink } from 'react-router'
import { CommunityIcon, LogoMark, SpeakerIcon, StopIcon } from '../icons'
import styles from './Header.module.css'

export type AppHeaderProps = {
  homeLabel: string
  slogan: string
  /** Link do topo para a Comunidade (leva junto o ponto da lavoura, se houver). */
  community: { label: string; to: string }
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

export function AppHeader({ homeLabel, slogan, community, listen, lang }: AppHeaderProps) {
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
