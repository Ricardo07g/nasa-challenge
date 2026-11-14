import { Card } from '../design-system/components/Card'
import { BackLink } from '../design-system/components/Navigation'
import type { Messages } from '../i18n/messages.pt'
import layout from './layout.module.css'

/** Provisório: telas do protótipo que ainda não foram implementadas. */
export function ComingSoonView({ t, title }: { t: Messages; title: string }) {
  return (
    <div className={layout.page}>
      <BackLink to="/">{t.nav.back}</BackLink>
      <Card as="section" aria-label={title}>
        <h1 className={layout.sectionTitle}>{title}</h1>
        <p className={layout.muted}>
          {t.common.comingSoonTitle}. {t.common.comingSoonText}
        </p>
      </Card>
    </div>
  )
}
