import { useId } from 'react'
import { MinusIcon, PlusIcon } from '../icons'
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

type NumberStepperProps = {
  label: string
  value: string
  unit: string
  step: number
  decreaseLabel: string
  increaseLabel: string
  onChange: (value: string) => void
  /** Botões − e +: recebem -step ou +step. */
  onStep: (delta: number) => void
  /** Ao sair do campo (para normalizar o valor). */
  onCommit: () => void
}

/** Campo numérico grande com botões de menos e mais (ex.: hectares para testar). */
export function NumberStepper(props: NumberStepperProps) {
  const id = useId()
  return (
    <div className={styles.stepperField}>
      <label htmlFor={id} className={styles.stepperLabel}>
        {props.label}
      </label>
      <div className={styles.stepper}>
        <button type="button" className={styles.stepperButton} aria-label={props.decreaseLabel} onClick={() => props.onStep(-props.step)}>
          <MinusIcon size={20} />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          className={styles.stepperInput}
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          onBlur={props.onCommit}
        />
        <span className={styles.stepperUnit}>{props.unit}</span>
        <button type="button" className={styles.stepperButton} aria-label={props.increaseLabel} onClick={() => props.onStep(props.step)}>
          <PlusIcon size={20} />
        </button>
      </div>
    </div>
  )
}

type MeasureFieldProps = {
  label: string
  value: string
  unit: string
  /** Dica embaixo do campo (ex.: os limites aceitos), lida junto pelo leitor de tela. */
  hint?: string
  onChange: (value: string) => void
}

/** Campo de medida digitada (ex.: milímetros de chuva), com teclado de número e a unidade ao lado. */
export function MeasureField({ label, value, unit, hint, onChange }: MeasureFieldProps) {
  const id = useId()
  const hintId = useId()
  return (
    <div className={styles.stepperField}>
      <label htmlFor={id} className={styles.stepperLabel}>
        {label}
      </label>
      <div className={styles.stepper}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className={styles.stepperInput}
          value={value}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className={styles.stepperUnit}>{unit}</span>
      </div>
      {hint && (
        <p id={hintId} className={styles.dateStatus}>
          {hint}
        </p>
      )}
    </div>
  )
}
