import { useId } from 'react'
import type { ListenSummaryState } from '../controllers/useListenSummary'
import { BackButton } from '../design-system/components/BackButton'
import { Button } from '../design-system/components/Button'
import { ListenSummary } from '../design-system/components/ListenSummary'
import { BookIcon } from '../design-system/icons'
import type { Messages } from '../i18n/messages.pt'
import styles from './CommunitySoonView.module.css'

export type CommunitySoonViewProps = {
  t: Messages
  backTo: string
  guideTo: string
  listen: ListenSummaryState
}

/**
 * Comunidade "em breve" (`/comunidade`, pacote 3, tarefa 0061): só o cartão "Em breve: Comunidade da sua região"
 * com o "Abrir o Guia" (e o Voltar e o "Ouvir resumo" das regras gerais). Nenhum relato de vizinho aparece aqui.
 */
export function CommunitySoonView({ t, backTo, guideTo, listen }: CommunitySoonViewProps) {
  const c = t.comingSoon
  const titleId = useId()
  return (
    <div className={styles.page}>
      <BackButton to={backTo}>{t.nav.back}</BackButton>
      <section className={styles.card} aria-labelledby={titleId}>
        <div className={styles.about}>
          <span className={styles.tag}>{c.tag}</span>
          <h1 id={titleId} className={styles.title}>
            {c.title}
          </h1>
          <p className={styles.text}>{c.text}</p>
          <ListenSummary
            supported={listen.supported}
            speaking={listen.speaking}
            onToggle={listen.toggle}
            label={t.listen.summary}
            stopLabel={t.listen.stop}
            className={styles.listen}
          />
          <ul className={styles.list} aria-label={c.listLabel}>
            <li>{c.planted}</li>
            <li>{c.rain}</li>
            <li>{c.events}</li>
          </ul>
        </div>
        <div className={styles.guide}>
          <p>{c.guideText}</p>
          <Button to={guideTo} icon={<BookIcon size={18} />}>
            {c.guideButton}
          </Button>
        </div>
      </section>
    </div>
  )
}
