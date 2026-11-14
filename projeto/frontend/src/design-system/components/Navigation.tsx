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

export type AnswerTab = { to: string; label: string; current: boolean }

/** Abas das telas da resposta (Resposta · Plano de 3 anos · Todas as opções). */
export function AnswerTabs({ label, tabs }: { label: string; tabs: readonly AnswerTab[] }) {
  return (
    <nav aria-label={label} className={styles.tabs}>
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          className={styles.tab}
          aria-current={tab.current ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
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
