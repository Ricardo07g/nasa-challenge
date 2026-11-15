import { useRef, type KeyboardEvent } from 'react'
import styles from './Tabs.module.css'

export type TabItem<T extends string> = {
  id: T
  label: string
  /** `id` do painel (`role="tabpanel"`) que a aba mostra; a aba ganha o id `<panelId>-tab`. */
  panelId: string
}

export type TabsProps<T extends string> = {
  label: string
  tabs: readonly TabItem<T>[]
  selected: T
  onSelect: (id: T) => void
}

/**
 * Abas da tela 5 ("1. Escolher" e "2. Plano de 3 anos"): `tablist` acessível, com o número de cada etapa. Tocar
 * escolhe a aba; as setas (e Home/End) trocam de aba e levam o foco junto (ativação automática). O painel de cada
 * aba fica com a tela (`role="tabpanel"`, `id = panelId`, `aria-labelledby = <panelId>-tab`).
 */
export function Tabs<T extends string>({ label, tabs, selected, onSelect }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = tabs.findIndex((tab) => tab.id === selected)
    const last = tabs.length - 1
    const next =
      event.key === 'ArrowRight'
        ? current === last ? 0 : current + 1
        : event.key === 'ArrowLeft'
          ? current === 0 ? last : current - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    onSelect(tabs[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className={styles.tabs} onKeyDown={onKeyDown}>
      {tabs.map((tab, index) => {
        const isSelected = tab.id === selected
        return (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[index] = element
            }}
            type="button"
            role="tab"
            id={`${tab.panelId}-tab`}
            aria-selected={isSelected}
            aria-controls={tab.panelId}
            tabIndex={isSelected ? 0 : -1}
            className={styles.tab}
            onClick={() => onSelect(tab.id)}
          >
            <span className={styles.number} aria-hidden="true">
              {index + 1}
            </span>
            <span>{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
