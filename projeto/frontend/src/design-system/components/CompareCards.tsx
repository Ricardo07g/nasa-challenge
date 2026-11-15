import { useState, type CSSProperties, type ReactNode, type UIEvent } from 'react'
import styles from './CompareCards.module.css'

export type CompareCard = {
  key: string
  /** Nome do grupo (a cultura), para o leitor de tela. */
  label: string
  header: ReactNode
  /** Uma célula por linha, na ordem de `rowLabels`. */
  cells: readonly ReactNode[]
  footer: ReactNode
  /** A coluna da escolha do plano, com o fundo verde-claro. */
  highlighted?: boolean
}

export type CompareCardsProps = {
  label: string
  /** Nomes das linhas, na coluna da esquerda do computador (cada célula repete o nome para o leitor de tela). */
  rowLabels: readonly string[]
  cards: readonly CompareCard[]
  /** "Arraste para o lado para ver as outras" (só no celular, com mais de um cartão). */
  hint: string
}

/**
 * "Comparar até 3" da tela 5, com um DOM só: no computador, uma tabela com uma coluna por cultura (as linhas se
 * alinham com `subgrid`); no celular (até 900 px), um cartão completo por cultura, arrastando para o lado
 * (`scroll-snap`, cerca de 86% da largura, deixando aparecer o próximo), com as bolinhas de posição e a dica.
 * Só o contêiner rola para o lado: a página não.
 */
export function CompareCards({ label, rowLabels, cards, hint }: CompareCardsProps) {
  const [active, setActive] = useState(0)
  const rows = rowLabels.length + 2

  function onScroll(event: UIEvent<HTMLDivElement>) {
    const scroller = event.currentTarget
    const card = scroller.querySelector<HTMLElement>('[role="group"]')
    const width = card?.offsetWidth ?? 0
    if (width > 0) setActive(Math.min(cards.length - 1, Math.max(0, Math.round(scroller.scrollLeft / width))))
  }

  const grid = { '--compare-cols': cards.length, '--compare-rows': rows } as CSSProperties
  return (
    <section aria-label={label} className={styles.wrap}>
      <div
        className={styles.grid}
        style={grid}
        data-scroller=""
        data-single={cards.length === 1 ? '' : undefined}
        onScroll={onScroll}
      >
        <div className={styles.labels} data-row-labels="" aria-hidden="true">
          <span className={styles.labelHead} />
          {rowLabels.map((row) => (
            <span key={row} className={styles.label}>
              {row}
            </span>
          ))}
          <span className={styles.labelFoot} />
        </div>
        {cards.map((card) => (
          <div key={card.key} role="group" aria-label={card.label} className={styles.card} data-highlighted={card.highlighted ? '' : undefined}>
            <div className={styles.head}>{card.header}</div>
            {card.cells.map((cell, index) => (
              <div key={rowLabels[index] ?? index} className={styles.cell}>
                {cell}
              </div>
            ))}
            <div className={styles.foot}>{card.footer}</div>
          </div>
        ))}
      </div>
      {cards.length > 1 && (
        <div className={styles.mobileOnly}>
          <div className={styles.dots} aria-hidden="true">
            {cards.map((card, index) => (
              <span key={card.key} className={styles.dot} data-dot="" data-active={index === active} />
            ))}
          </div>
          <p className={styles.hint}>{hint}</p>
        </div>
      )}
    </section>
  )
}
