import { useEffect, useId, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { ChevronRightIcon } from '../icons'
import styles from './Instrument.module.css'

/**
 * Painel de instrumento do raio-X (tela 4, tarefas 0043 e 0058): o único elemento escuro da tela. No topo, o
 * mapinha, o olho "Raio-X da sua terra", o lugar (o título da seção), as coordenadas e o selo da leitura; embaixo,
 * a grade de blocos (4 por linha no computador, 2 no celular) e a nota. Os blocos entram em sequência (CSS); com
 * "reduzir movimento" tudo aparece parado.
 */
export function InstrumentPanel({
  eyebrow,
  title,
  media,
  meta,
  aside,
  note,
  children,
}: {
  eyebrow: string
  /** O lugar ("Lavoura de demonstração, perto de Uberlândia (MG)"): o nome da seção. */
  title: string
  /** O mapinha. */
  media?: ReactNode
  /** As coordenadas. */
  meta?: ReactNode
  /** O selo "Leitura mais recente". */
  aside?: ReactNode
  note?: ReactNode
  /** Os blocos (`InstrumentBlock`). */
  children: ReactNode
}) {
  const titleId = useId()
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.top}>
        <div className={styles.identity}>
          {media && <div className={styles.media}>{media}</div>}
          <div className={styles.identityText}>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {meta && <p className={styles.meta}>{meta}</p>}
          </div>
        </div>
        {aside}
      </div>
      <ul className={styles.grid}>{children}</ul>
      {note && <p className={styles.note}>{note}</p>}
    </section>
  )
}

/** Selo "Leitura mais recente: …", com o pontinho verde de "ao vivo". */
export function LiveBadge({ children }: { children: ReactNode }) {
  return (
    <span className={styles.live}>
      <span className={styles.liveDot} aria-hidden="true" />
      <span>{children}</span>
    </span>
  )
}

type InstrumentBlockProps = {
  /** Posição na grade: atrasa a entrada do bloco (sequência). */
  index: number
  label: string
  /** O número (pode ser um `CountUp`). */
  value: ReactNode
  unit: string
  /** Uma linha de texto: o detalhe fica no modal. */
  line: string
  /** Fonte e resolução (ex.: "SMAP · NASA · 9 km"). */
  badge: string
  /** "Ver detalhes": escondido, completa o nome do botão para o leitor de tela. */
  detailsLabel: string
  onOpen: () => void
  /** Desenho do dado (barra do solo, umidade), entre o número e a linha. */
  bar?: ReactNode
}

/**
 * Um bloco enxuto (pacote 2): só o nome, o número grande, uma linha e o selo da fonte. O bloco inteiro é um
 * botão que abre o modal com o texto completo, a fonte e o "Saiba mais".
 */
export function InstrumentBlock({ index, label, value, unit, line, badge, detailsLabel, onOpen, bar }: InstrumentBlockProps) {
  return (
    <li className={styles.item} style={{ '--i': index } as CSSProperties}>
      <button type="button" className={styles.block} aria-haspopup="dialog" onClick={onOpen}>
        {/* Os espaços entre as partes separam as palavras no nome do botão (o flex não os desenha). */}
        <span className={styles.blockLabel}>
          <span>{label}</span>
          <ChevronRightIcon size={15} />
        </span>{' '}
        <span className={styles.reading}>
          <span className={styles.value}>{value}</span> <span className={styles.unit}>{unit}</span>
        </span>{' '}
        {bar}
        <span className={styles.line}>{line}</span> <span className={styles.spacer} />
        <SourceBadge>{badge}</SourceBadge> <span className="visually-hidden">{detailsLabel}</span>
      </button>
    </li>
  )
}

/** Selo pequeno com a fonte e a resolução do dado (ex.: "SMAP · NASA · 9 km"). */
export function SourceBadge({ children }: { children: ReactNode }) {
  return <span className={styles.badge}>{children}</span>
}

/** Barra do solo no bloco (argila, silte e areia): só desenha, os números estão no bloco e no modal. */
export function SoilBar({ clay, silt, sand }: { clay: number; silt: number; sand: number }) {
  return (
    <span className={styles.soilBar} aria-hidden="true">
      <span data-part="clay" style={{ flexGrow: clay }} />
      <span data-part="silt" style={{ flexGrow: silt }} />
      <span data-part="sand" style={{ flexGrow: sand }} />
    </span>
  )
}

/** Barra da umidade no bloco (de mais seca a mais úmida), com a marca no percentil: só desenha. */
export function MoistureBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <span className={styles.moistureBar} aria-hidden="true">
      <span className={styles.moistureMark} data-mark="" style={{ left: `${clamped}%` }} />
    </span>
  )
}

const COUNT_MS = 700
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * Número que conta de 0 até o valor na chegada. O texto renderizado é sempre o valor final (leitor de
 * tela, "Ouvir" e testes); a contagem só troca o texto na tela, e não acontece com "reduzir movimento".
 */
export function CountUp({ value, format }: { value: number; format: (value: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const formatRef = useRef(format)
  // O formato mais recente, sem reiniciar a contagem a cada desenho (a função muda a cada render).
  useLayoutEffect(() => {
    formatRef.current = format
  })

  useEffect(() => {
    const node = ref.current
    if (!node || typeof window.matchMedia !== 'function' || window.matchMedia(REDUCED_MOTION).matches) return
    let frame = 0
    let start: number | null = null
    const step = (now: number) => {
      start ??= now
      const progress = Math.min(1, (now - start) / COUNT_MS)
      node.textContent = formatRef.current(value * (1 - (1 - progress) ** 3))
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(frame)
      node.textContent = formatRef.current(value)
    }
  }, [value])

  return <span ref={ref}>{format(value)}</span>
}
