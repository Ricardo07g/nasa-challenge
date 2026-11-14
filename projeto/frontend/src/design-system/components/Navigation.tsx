import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowLeftIcon } from '../icons'
import styles from './Navigation.module.css'

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={styles.back}>
      <ArrowLeftIcon />
      {children}
    </Link>
  )
}

export function QuestionStepper({ current, total, label }: { current: number; total: number; label: string }) {
  return (
    <div role="img" aria-label={label} className={styles.stepper}>
      <span className={styles.stepperLabel} aria-hidden="true">
        {label}
      </span>
      <span className={styles.bars} aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={styles.bar} data-done={index < current} />
        ))}
      </span>
    </div>
  )
}
