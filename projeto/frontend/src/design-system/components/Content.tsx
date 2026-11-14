import { useId, useState, type ReactNode } from 'react'
import { ChevronDownIcon, ShieldIcon, SproutIcon } from '../icons'
import styles from './Content.module.css'

export function PageHeading({ title, subtitle, eyebrow }: { title: string; subtitle?: string; eyebrow?: string }) {
  return (
    <div className={styles.heading}>
      {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  )
}

export function NumberedSteps({ steps, size = 'md' }: { steps: readonly string[]; size?: 'md' | 'lg' }) {
  return (
    <ol className={styles.steps} data-size={size}>
      {steps.map((step, index) => (
        <li key={step} className={styles.step}>
          <span className={styles.stepNumber} aria-hidden="true">
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

type DisclosureProps = {
  openLabel: string
  closeLabel: string
  children: ReactNode
}

export function Disclosure({ openLabel, closeLabel, children }: DisclosureProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <div className={styles.disclosure}>
      <button
        type="button"
        className={styles.disclosureButton}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? closeLabel : openLabel}
        <ChevronDownIcon />
      </button>
      {open && (
        <div id={panelId} className={styles.disclosurePanel}>
          {children}
        </div>
      )}
    </div>
  )
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <p className={styles.disclaimer}>{children}</p>
}

type RecommendationHeroProps = {
  label: string
  title: string
  children?: ReactNode
  /** Na tela da resposta, o nome da cultura é o título principal da página (h1). */
  as?: 'h1' | 'h2'
}

export function RecommendationHero({ label, title, children, as: Heading = 'h2' }: RecommendationHeroProps) {
  return (
    <div className={styles.hero}>
      <span className={styles.heroDecor}>
        <SproutIcon size={65} />
      </span>
      <span className={styles.heroLabel}>
        <ShieldIcon size={20} />
        {label}
      </span>
      <Heading className={styles.heroTitle}>{title}</Heading>
      {children}
    </div>
  )
}

type TimelineItem = { year: number; title: string; text: string }

export function YearTimeline({ label, items }: { label: string; items: readonly TimelineItem[] }) {
  return (
    <ol className={styles.timeline} aria-label={label}>
      {items.map((item) => (
        <li key={item.year} className={styles.timelineItem}>
          <span className={styles.yearTile}>{item.year}</span>
          <span className={styles.timelineText}>
            <strong className={styles.timelineTitle}>{item.title}</strong>
            <span>{item.text}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

type CompareRow = {
  label: string
  value: string
  /** Ícone do eixo (gota, nota, broto); azul para dado de satélite. */
  icon?: ReactNode
  iconTone?: 'green' | 'blue'
  /** Rótulo Bom/Médio/Fraco, embaixo da frase. */
  pill?: ReactNode
  /** Conteúdo extra embaixo da frase (ex.: os 20 quadrinhos da chuva). */
  extra?: ReactNode
}

type OptionCompareCardProps = {
  rank: string
  name: string
  rows: readonly CompareRow[]
  highlighted?: boolean
  /** Fora da janela de plantio: cartão laranja com este aviso no lugar das linhas. */
  unavailable?: string
}

export function OptionCompareCard({ rank, name, rows, highlighted = false, unavailable }: OptionCompareCardProps) {
  const titleId = useId()
  return (
    <article
      className={styles.compare}
      data-highlighted={highlighted}
      data-unavailable={unavailable !== undefined}
      aria-labelledby={titleId}
    >
      <div className={styles.compareHead}>
        <span className={styles.rank}>{rank}</span>
        <h3 id={titleId} className={styles.compareName}>
          {name}
        </h3>
      </div>
      {unavailable !== undefined ? (
        <p>{unavailable}</p>
      ) : (
        rows.map((row) => (
          <div key={row.label} className={styles.compareRow} data-icon={row.icon !== undefined}>
            {row.icon && (
              <span className={styles.compareIcon} data-tone={row.iconTone ?? 'green'}>
                {row.icon}
              </span>
            )}
            <span className={styles.compareText}>
              <span className={styles.compareLabel}>{row.label}</span>
              <span className={styles.compareValue}>{row.value}</span>
              {row.extra && <span className={styles.compareExtra}>{row.extra}</span>}
              {row.pill && <span className={styles.comparePill}>{row.pill}</span>}
            </span>
          </div>
        ))
      )}
    </article>
  )
}

type ScoreTableProps = {
  caption: string
  headers: readonly string[]
  /** null = nota que ainda não existe (ex.: futuro sem CMIP6): aparece "—". */
  rows: readonly { name: string; values: readonly (number | null)[] }[]
}

/** Tabela simples de notas (só na tela "Como a conta é feita"). Rola para o lado no celular. */
export function ScoreTable({ caption, headers, rows }: ScoreTableProps) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.tableCaption}>{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row">{row.name}</th>
              {row.values.map((value, index) => (
                <td key={index}>{value ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type TimelineEvent = { key: string; date: string; icon: ReactNode; text: string; warning: boolean }

/** Linha do tempo de eventos (replay da safra): ícone, data e frase; avisos em destaque. */
export function EventTimeline({ label, events }: { label: string; events: readonly TimelineEvent[] }) {
  return (
    <ol className={styles.events} aria-label={label}>
      {events.map((event) => (
        <li key={event.key} className={styles.event} data-warning={event.warning}>
          <span className={styles.eventIcon} aria-hidden="true">
            {event.icon}
          </span>
          <div className={styles.eventBody}>
            <span className={styles.eventDate}>{event.date}</span>
            <p>{event.text}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
