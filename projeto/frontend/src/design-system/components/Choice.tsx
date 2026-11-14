import { useId } from 'react'
import styles from './Choice.module.css'

export type ChipOption<T extends string> = { value: T; label: string }

type ChipGroupProps<T extends string> = {
  label: string
  options: readonly ChipOption<T>[]
  value: T | null
  onChange: (value: T | null) => void
  tone?: 'green' | 'blue'
  /** Tocar na opção já escolhida volta para "nenhuma" (ex.: ordenação da tela 6). */
  allowDeselect?: boolean
}

export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  tone = 'green',
  allowDeselect = false,
}: ChipGroupProps<T>) {
  return (
    <div role="group" aria-label={label} className={styles.chips} data-tone={tone}>
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            className={styles.chip}
            aria-pressed={selected}
            onClick={() => {
              if (!selected) onChange(option.value)
              else if (allowDeselect) onChange(null)
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

type RadioCardProps = {
  title: string
  sub: string
  selected: boolean
  onSelect: () => void
  /** Quando a opção abre mais campos (ex.: "Colocar a data exata"): se estão abertos. */
  expanded?: boolean
}

export function RadioCard({ title, sub, selected, onSelect, expanded }: RadioCardProps) {
  return (
    <button
      type="button"
      className={styles.radioCard}
      aria-pressed={selected}
      aria-expanded={expanded}
      onClick={onSelect}
    >
      <span className={styles.radioText}>
        <span className={styles.radioTitle}>{title}</span>
        <span className={styles.radioSub}>{sub}</span>
      </span>
      <span className={styles.mark} aria-hidden="true" />
    </button>
  )
}

type DateFieldProps = {
  label: string
  value: string
  min: string
  max: string
  onChange: (value: string) => void
  /** Aviso embaixo do campo (ex.: em qual faixa o dia caiu). */
  status?: string
}

/** Campo de data grande (60 px), com o calendário do próprio aparelho. */
export function DateField({ label, value, min, max, onChange, status }: DateFieldProps) {
  const id = useId()
  return (
    <div className={styles.dateField}>
      <label htmlFor={id} className={styles.dateLabel}>
        {label}
      </label>
      <input
        id={id}
        type="date"
        className={styles.dateInput}
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
      {status && (
        <p role="status" className={styles.dateStatus}>
          {status}
        </p>
      )}
    </div>
  )
}
