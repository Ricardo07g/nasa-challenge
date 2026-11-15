import { ListenIcon, StopIcon } from '../icons'
import styles from './ListenSummary.module.css'

export type ListenSummaryProps = {
  supported: boolean
  speaking: boolean
  onToggle: () => void
  /** "Ouvir resumo" / "Listen to summary". */
  label: string
  /** "Parar" / "Stop". */
  stopLabel: string
}

/**
 * "Ouvir resumo" (regra geral da remodelagem, tarefa 0052): link discreto perto do título de cada tela,
 * nunca um botão grande no cabeçalho. Fala só o resumo da tela (o estado vem do `useListenSummary`).
 * Enquanto fala, vira "Parar" com o quadrado e `aria-pressed`. Sem voz no navegador, não aparece.
 */
export function ListenSummary({ supported, speaking, onToggle, label, stopLabel }: ListenSummaryProps) {
  if (!supported) return null
  return (
    <button type="button" className={styles.listen} aria-pressed={speaking} onClick={onToggle}>
      {speaking ? <StopIcon size={17} /> : <ListenIcon size={17} />}
      <span className={styles.label}>{speaking ? stopLabel : label}</span>
    </button>
  )
}
