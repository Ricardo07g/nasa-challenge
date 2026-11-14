import type { ReactNode } from 'react'
import { CheckFilledIcon, SatelliteIcon } from '../icons'
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
  iconTone?: 'green' | 'blue' | 'soil' | 'risk'
}

export function DataSourceCard({ icon, title, subtitle, readyLabel, children, iconTone = 'green' }: DataSourceCardProps) {
  return (
    <div className={styles.dataSource}>
      <div className={styles.dataSourceHead}>
        <span className={styles.bubble} data-tone={iconTone}>
          {icon}
        </span>
        <div className={styles.dataSourceText}>
          <h2 className={styles.dataSourceTitle}>{title}</h2>
          <div className={styles.dataSourceSubtitle}>{subtitle}</div>
        </div>
        <span className={styles.ready} role="img" aria-label={readyLabel}>
          <CheckFilledIcon />
        </span>
      </div>
      {children}
    </div>
  )
}

export function AlternativeCard({ label, title, text }: { label: string; title: string; text: string }) {
  return (
    <div className={styles.alternative}>
      <span className={styles.alternativeLabel}>{label}</span>
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
