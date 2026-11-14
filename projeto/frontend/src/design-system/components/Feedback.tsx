import type { ReactNode } from 'react'
import { WarningIcon } from '../icons'
import { Button } from './Button'
import styles from './Feedback.module.css'

export function LoadingState({ children }: { children: ReactNode }) {
  return (
    <p role="status" className={styles.loading}>
      <span className={styles.spinner} aria-hidden="true" />
      {children}
    </p>
  )
}

type ErrorStateProps = { message: string; retryLabel: string; onRetry: () => void }

export function ErrorState({ message, retryLabel, onRetry }: ErrorStateProps) {
  return (
    <div className={styles.error}>
      <p role="alert">{message}</p>
      <div className={styles.retry}>
        <Button variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    </div>
  )
}

/**
 * Aviso fixo do modo de demonstração (VITE_API_MODE=mock): fica no topo de todas as telas, para
 * ninguém confundir os dados de exemplo com os da NASA.
 */
export function DemoBanner({ children }: { children: ReactNode }) {
  return (
    <p role="note" className={styles.demo}>
      <WarningIcon size={18} />
      <strong>{children}</strong>
    </p>
  )
}

/** Bloco cinza pulsando no lugar de um cartão enquanto os dados chegam (a tela nunca fica em branco). */
export function SkeletonCard() {
  return <div className={styles.skeleton} aria-hidden="true" />
}

/** Barra de progresso (ex.: fases da missão). A largura acompanha `value / max`. */
export function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={styles.progress}
    >
      <span className={styles.progressFill} style={{ transform: `scaleX(${max > 0 ? value / max : 0})` }} />
    </div>
  )
}
