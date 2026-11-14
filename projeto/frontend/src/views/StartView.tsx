import { Link } from 'react-router'
import { Button } from '../design-system/components/Button'
import { CalendarIcon, CheckCircleIcon, PinIcon } from '../design-system/icons'
import type { Messages } from '../i18n/messages.pt'
import styles from './StartView.module.css'

/** Tela 1 "Início" (protótipo v3). Só apresentação: não tem controller. */
export function StartView({ t }: { t: Messages }) {
  const s = t.start
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.text}>
          <span className={styles.eyebrow}>{s.eyebrow}</span>
          <h1 className={styles.title}>{s.title}</h1>
          <p className={styles.lead}>{s.lead}</p>
          <div className={styles.actions}>
            <Button to="/onde">{s.start}</Button>
            <span className={styles.meta}>{s.meta}</span>
            <Button to="/exemplo" variant="outline">
              {s.example}
            </Button>
          </div>
        </div>
        <div className={styles.illustration} aria-hidden="true">
          <svg viewBox="0 0 346 220">
            <circle cx="268" cy="56" r="26" fill="var(--color-surface)" opacity="0.7" />
            <ellipse
              cx="268"
              cy="56"
              rx="62"
              ry="18"
              fill="none"
              stroke="var(--color-secondary)"
              strokeWidth="1.5"
              strokeDasharray="4 5"
              transform="rotate(-18 268 56)"
            />
            <rect x="296" y="24" width="16" height="10" rx="2" fill="var(--color-secondary)" />
            <path d="M290 29h-8M318 29h8" stroke="var(--color-secondary)" strokeWidth="2" />
            <path d="M0 150 Q 120 118 346 132 L346 220 L0 220 Z" fill="var(--color-hero-field)" />
            <path
              d="M0 172 Q 140 144 346 158M0 190 Q 150 164 346 178M0 208 Q 160 184 346 198"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="3"
            />
            <path
              d="M40 160v-14M40 150c-5 0-8-3-8-8M40 152c5 0 8-3 8-8M110 150v-14M110 140c-5 0-8-3-8-8M110 142c5 0 8-3 8-8M190 144v-14M190 134c-5 0-8-3-8-8M190 136c5 0 8-3 8-8"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </section>

      <ul className={styles.steps}>
        <li className={styles.step}>
          <PinIcon />
          <span>{s.stepMark}</span>
        </li>
        <li className={styles.step}>
          <CalendarIcon />
          <span>{s.stepHarvest}</span>
        </li>
        <li className={styles.step}>
          <CheckCircleIcon />
          <span>{s.stepAnswer}</span>
        </li>
      </ul>

      <p className={styles.disclaimer}>
        {t.common.disclaimer} <Link to="/como-funciona">{s.agronomist}</Link>
      </p>
    </div>
  )
}
