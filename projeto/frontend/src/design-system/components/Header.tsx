import { Link } from 'react-router'
import { LogoMark, SpeakerIcon } from '../icons'
import styles from './Header.module.css'

export type AppHeaderProps = {
  homeLabel: string
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

export function AppHeader({ homeLabel, listen, lang }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.logo} aria-label={homeLabel}>
          <LogoMark />
          <span className={styles.logoText} aria-hidden="true">
            Raiz Orbital
          </span>
        </Link>
        <div className={styles.actions}>
          {listen.supported && (
            <button
              type="button"
              className={styles.listen}
              aria-label={listen.speaking ? listen.stopLabel : listen.label}
              aria-pressed={listen.speaking}
              onClick={listen.onToggle}
            >
              <SpeakerIcon />
              {listen.speaking ? listen.stopText : listen.text}
            </button>
          )}
          <button type="button" className={styles.lang} aria-label={lang.label} onClick={lang.onToggle}>
            <span data-active={lang.current === 'pt'}>PT</span>
            <span aria-hidden="true"> | </span>
            <span data-active={lang.current === 'en'}>EN</span>
          </button>
        </div>
      </div>
    </header>
  )
}
