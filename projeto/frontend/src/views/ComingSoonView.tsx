import { Card } from '../design-system/components/Card'
import { AnswerTabs, BackLink, type AnswerTab } from '../design-system/components/Navigation'
import type { Messages } from '../i18n/messages.pt'
import layout from './layout.module.css'

type ComingSoonViewProps = {
  t: Messages
  title: string
  /** Telas da resposta: abas no topo e o Voltar indo para a colheita. */
  answerNav?: { label: string; tabs: AnswerTab[]; backTo: string }
}

/** Provisório: telas do protótipo que ainda não foram implementadas. */
export function ComingSoonView({ t, title, answerNav }: ComingSoonViewProps) {
  return (
    <div className={layout.page}>
      <BackLink to={answerNav?.backTo ?? '/'}>{t.nav.back}</BackLink>
      {answerNav && <AnswerTabs label={answerNav.label} tabs={answerNav.tabs} />}
      <Card as="section" aria-label={title}>
        <h1 className={layout.sectionTitle}>{title}</h1>
        <p className={layout.muted}>
          {t.common.comingSoonTitle}. {t.common.comingSoonText}
        </p>
      </Card>
    </div>
  )
}
