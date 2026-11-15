import { useId, useState, type KeyboardEvent } from 'react'
import { SearchIcon, WarningIcon } from '../icons'
import styles from './PlaceSearch.module.css'

export type PlaceSearchOption = { id: string; label: string; detail?: string }

export type PlaceSearchProps = {
  /** Rótulo visível do campo. */
  label: string
  /** Dica embaixo do campo (ex.: também aceita coordenadas). */
  hint?: string
  /** Nome da lista para o leitor de tela. */
  listLabel: string
  value: string
  onChange: (value: string) => void
  options: readonly PlaceSearchOption[]
  onSelect: (id: string) => void
  /** Situação da busca ("Procurando…", "3 lugares"), lida pelo leitor de tela sem interromper. */
  status?: string | null
  /** Aviso sobre o que foi colado (ex.: link curto). */
  notice?: string | null
  /** Crédito dos dados de endereço (sempre visível). */
  attribution: { text: string; href: string }
}

/**
 * Campo de busca com autocompletar (padrão "combobox" com lista, WAI-ARIA 1.2): setas andam pela lista,
 * Enter escolhe (sem nada marcado, a primeira opção), Esc fecha. Só desenha: quem busca é o controller.
 */
export function PlaceSearch({
  label,
  hint,
  listLabel,
  value,
  onChange,
  options,
  onSelect,
  status,
  notice,
  attribution,
}: PlaceSearchProps) {
  const id = useId()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [closed, setClosed] = useState(false)
  const showList = !closed && options.length > 0
  const activeIndex = options.findIndex((option) => option.id === activeId)
  const optionDomId = (optionId: string) => `${id}-opcao-${optionId}`

  function choose(optionId: string) {
    setActiveId(null)
    onSelect(optionId)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setClosed(true)
      setActiveId(null)
      return
    }
    if (options.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      const start = activeIndex === -1 ? (step === 1 ? -1 : 0) : activeIndex
      setClosed(false)
      setActiveId(options[(start + step + options.length) % options.length].id)
      return
    }
    if (event.key === 'Enter' && showList) {
      event.preventDefault()
      choose(options[activeIndex === -1 ? 0 : activeIndex].id)
    }
  }

  const describedBy = [hint ? `${id}-dica` : null, notice ? `${id}-aviso` : null].filter(Boolean).join(' ')

  return (
    <div className={styles.search}>
      <label htmlFor={`${id}-campo`} className={styles.label}>
        {label}
      </label>
      <div className={styles.field}>
        <span className={styles.icon}>
          <SearchIcon />
        </span>
        <input
          id={`${id}-campo`}
          className={styles.input}
          // "text", não "search": no Chrome o Esc de um campo "search" apaga o que foi digitado.
          type="text"
          inputMode="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={showList && activeIndex !== -1 ? optionDomId(options[activeIndex].id) : undefined}
          aria-describedby={describedBy || undefined}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          value={value}
          onChange={(event) => {
            setClosed(false)
            setActiveId(null)
            onChange(event.target.value)
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setClosed(false)}
          onBlur={() => setClosed(true)}
        />
        {showList && (
          <ul id={`${id}-lista`} role="listbox" aria-label={listLabel} className={styles.list}>
            {options.map((option, index) => (
              <li
                key={option.id}
                id={optionDomId(option.id)}
                role="option"
                aria-selected={index === activeIndex}
                className={styles.option}
                // Não tira o foco do campo antes do toque valer.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option.id)}
              >
                <span className={styles.optionLabel}>{option.label}</span>
                {option.detail && <span className={styles.optionDetail}>{option.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && (
        <p id={`${id}-dica`} className={styles.hint}>
          {hint}
        </p>
      )}
      <p role="status" className={styles.status}>
        {status}
      </p>
      {notice && (
        <p id={`${id}-aviso`} role="alert" className={styles.notice}>
          <WarningIcon size={18} />
          <span>{notice}</span>
        </p>
      )}
      <p className={styles.attribution}>
        <a href={attribution.href} target="_blank" rel="noopener noreferrer">
          {attribution.text}
        </a>
      </p>
    </div>
  )
}
