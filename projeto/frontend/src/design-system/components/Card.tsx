import type { ReactNode } from 'react'
import { CheckIcon, SatelliteIcon } from '../icons'
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
}

/**
 * Cartão de um dado que chegou, com o ✓. Sem o dado, a tela não desenha o cartão (decisão D2: nada
 * de "Ainda não conectado").
 */
export function DataSourceCard({ icon, title, subtitle, readyLabel, children, iconTone = 'green' }: DataSourceCardProps) {
  return (
    <div className={styles.dataSource} data-status="ready">
      <div className={styles.dataSourceHead}>
        <IconBubble tone={iconTone}>{icon}</IconBubble>
        <div className={styles.dataSourceText}>
          <h2 className={styles.dataSourceTitle}>{title}</h2>
          <div className={styles.dataSourceSubtitle}>{subtitle}</div>
        </div>
        <span className={styles.ready} role="img" aria-label={readyLabel}>
          <CheckIcon />
        </span>
      </div>
      {children}
    </div>
  )
}

type AlternativeCardProps = {
  label: string
  title: string
  text: string
  icon?: ReactNode
  /** Imagem da planta no canto (tarefa 0044). */
  media?: ReactNode
  /** Ação no pé do cartão (ex.: "Comparar com a sugestão", aba Comparar, tarefa 0045). */
  action?: ReactNode
}

export function AlternativeCard({ label, title, text, icon, media, action }: AlternativeCardProps) {
  return (
    <div className={styles.alternative}>
      <span className={styles.alternativeHead}>
        <span className={styles.alternativeLabel}>
          {icon}
          {label}
        </span>
        {media && <span className={styles.alternativeMedia}>{media}</span>}
      </span>
      <h3 className={styles.alternativeTitle}>{title}</h3>
      <p className={styles.alternativeText}>{text}</p>
      {action}
    </div>
  )
}

type SourceCardProps = {
  what: string
  source: string
  scale: string
}

/** Uma fonte de dado ligada de fato; a que a API não manda não aparece (decisão D2). */
export function SourceCard({ what, source, scale }: SourceCardProps) {
  return (
    <div className={styles.source} data-status="ready">
      <h3 className={styles.sourceWhat}>{what}</h3>
      <span className={styles.sourceName}>{source}</span>
      <span className={styles.sourceScale}>{scale}</span>
    </div>
  )
}
