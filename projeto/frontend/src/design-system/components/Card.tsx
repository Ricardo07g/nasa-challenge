import type { ReactNode } from 'react'
import { CheckIcon, MinusIcon, SatelliteIcon } from '../icons'
import styles from './Card.module.css'

export type CardTone = 'white' | 'green' | 'blue' | 'orange'

type CardProps = {
  children: ReactNode
  tone?: CardTone
  highlighted?: boolean
  as?: 'div' | 'section' | 'article' | 'aside'
  'aria-label'?: string
  className?: string
}

export function Card({ children, tone = 'white', highlighted = false, as = 'div', className, ...aria }: CardProps) {
  const Tag = as
  return (
    <Tag
      className={[styles.card, className].filter(Boolean).join(' ')}
      data-tone={tone}
      data-highlighted={highlighted}
      aria-label={aria['aria-label']}
    >
      {children}
    </Tag>
  )
}

export type BubbleTone = 'green' | 'blue' | 'soil' | 'risk'

/** Bolinha com ícone (48 px; 38 px no celular), usada no topo dos cartões. */
export function IconBubble({ children, tone = 'green' }: { children: ReactNode; tone?: BubbleTone }) {
  return (
    <span className={styles.bubble} data-tone={tone}>
      {children}
    </span>
  )
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className={styles.banner}>
      <span className={styles.bannerIcon}>
        <SatelliteIcon />
      </span>
      <p>{children}</p>
    </div>
  )
}

type DataSourceCardProps = {
  icon: ReactNode
  title: string
  subtitle: ReactNode
  readyLabel: string
  children?: ReactNode
  iconTone?: BubbleTone
  /** Sem o dado ainda: no lugar do ✓ vem um traço apagado, e a borda fica tracejada (como o ano sem certeza). */
  status?: 'ready' | 'unavailable'
  /** Texto acessível do traço (ex.: "Ainda não disponível"). */
  unavailableLabel?: string
}

export function DataSourceCard({
  icon,
  title,
  subtitle,
  readyLabel,
  children,
  iconTone = 'green',
  status = 'ready',
  unavailableLabel,
}: DataSourceCardProps) {
  return (
    <div className={styles.dataSource} data-status={status}>
      <div className={styles.dataSourceHead}>
        <IconBubble tone={iconTone}>{icon}</IconBubble>
        <div className={styles.dataSourceText}>
          <h2 className={styles.dataSourceTitle}>{title}</h2>
          <div className={styles.dataSourceSubtitle}>{subtitle}</div>
        </div>
        {status === 'ready' ? (
          <span className={styles.ready} role="img" aria-label={readyLabel}>
            <CheckIcon />
          </span>
        ) : (
          <span className={styles.unavailable} role="img" aria-label={unavailableLabel}>
            <MinusIcon />
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

type AlternativeCardProps = { label: string; title: string; text: string; icon?: ReactNode }

export function AlternativeCard({ label, title, text, icon }: AlternativeCardProps) {
  return (
    <div className={styles.alternative}>
      <span className={styles.alternativeLabel}>
        {icon}
        {label}
      </span>
      <h3 className={styles.alternativeTitle}>{title}</h3>
      <p className={styles.alternativeText}>{text}</p>
    </div>
  )
}

export function SourceCard({ what, source, scale }: { what: string; source: string; scale: string }) {
  return (
    <div className={styles.source}>
      <h3 className={styles.sourceWhat}>{what}</h3>
      <span className={styles.sourceName}>{source}</span>
      <span className={styles.sourceScale}>{scale}</span>
    </div>
  )
}
