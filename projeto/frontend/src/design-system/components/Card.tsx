import type { ReactNode } from 'react'
import { CheckIcon, SatelliteIcon } from '../icons'
import styles from './Card.module.css'
import { NotConnected } from './Status'

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
  /**
   * Sem o dado ainda: a borda fica tracejada e, no lugar do ✓ e do subtítulo, vem o aviso
   * "Ainda não conectado" (o mesmo de todas as telas).
   */
  status?: 'ready' | 'unavailable'
  /** Texto do aviso (ex.: "Ainda não conectado"). */
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
  unavailableLabel = '',
}: DataSourceCardProps) {
  const ready = status === 'ready'
  return (
    <div className={styles.dataSource} data-status={status}>
      <div className={styles.dataSourceHead}>
        <IconBubble tone={iconTone}>{icon}</IconBubble>
        <div className={styles.dataSourceText}>
          <h2 className={styles.dataSourceTitle}>{title}</h2>
          {ready ? (
            <div className={styles.dataSourceSubtitle}>{subtitle}</div>
          ) : (
            <NotConnected label={unavailableLabel} />
          )}
        </div>
        {ready && (
          <span className={styles.ready} role="img" aria-label={readyLabel}>
            <CheckIcon />
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

type NotConnectedCardProps = {
  title: string
  /** Texto do aviso (ex.: "Ainda não conectado"). */
  label: string
  icon?: ReactNode
  iconTone?: BubbleTone
  /** Nível do título (2 por padrão; 3 dentro de uma seção que já tem título). */
  level?: 2 | 3
  /** Explicação curta, quando ajuda (nunca número de exemplo). */
  children?: ReactNode
}

/**
 * Bloco que depende de um dado que a API ainda não manda: o título do bloco e o aviso
 * "Ainda não conectado", com a borda tracejada do DataSourceCard indisponível. O bloco não some.
 */
export function NotConnectedCard({ title, label, icon, iconTone = 'green', level = 2, children }: NotConnectedCardProps) {
  const Heading = level === 3 ? 'h3' : 'h2'
  return (
    <section className={styles.dataSource} data-status="unavailable" aria-label={title}>
      <div className={styles.dataSourceHead}>
        {icon && <IconBubble tone={iconTone}>{icon}</IconBubble>}
        <div className={styles.dataSourceText}>
          <Heading className={styles.dataSourceTitle}>{title}</Heading>
          <NotConnected label={label} />
        </div>
      </div>
      {children}
    </section>
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

type SourceCardProps = {
  what: string
  source: string
  scale: string
  /** Fonte que a API ainda não manda: o texto do aviso ("Ainda não conectado"); a borda fica tracejada. */
  notConnected?: string
}

export function SourceCard({ what, source, scale, notConnected }: SourceCardProps) {
  return (
    <div className={styles.source} data-status={notConnected ? 'unavailable' : 'ready'}>
      <h3 className={styles.sourceWhat}>{what}</h3>
      <span className={styles.sourceName}>{source}</span>
      <span className={styles.sourceScale}>{scale}</span>
      {notConnected && <NotConnected label={notConnected} />}
    </div>
  )
}
