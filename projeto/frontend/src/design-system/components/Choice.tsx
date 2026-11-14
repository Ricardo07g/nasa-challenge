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
}

export function RadioCard({ title, sub, selected, onSelect }: RadioCardProps) {
  return (
    <button type="button" className={styles.radioCard} aria-pressed={selected} onClick={onSelect}>
      <span className={styles.radioText}>
        <span className={styles.radioTitle}>{title}</span>
        <span className={styles.radioSub}>{sub}</span>
      </span>
      <span className={styles.mark} aria-hidden="true" />
    </button>
  )
}
