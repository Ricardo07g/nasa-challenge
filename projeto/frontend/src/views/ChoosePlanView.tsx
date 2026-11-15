import { BackButton } from '../design-system/components/BackButton'
import { ListenSummary } from '../design-system/components/ListenSummary'
import { Tabs } from '../design-system/components/Tabs'
import { PrinterIcon } from '../design-system/icons'
import type { AnswerTab, ChoosePlanState } from '../controllers/useChoosePlanController'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import { CURRENT_SEASON, seasonName } from '../services/seasonService'
import { CellModal, ScoreModal, WhyModal } from './ChooseModals'
import { ChooseTab } from './ChooseTab'
import { contextText } from './choiceTexts'
import { FlowError, FlowLoading, FlowOutside } from './FlowStates'
import { PlanReport } from './PlanReport'
import { PlanTab } from './PlanTab'
import styles from './ChoosePlanView.module.css'

export type ChoosePlanViewProps = { t: Messages; lang: Lang; state: ChoosePlanState }

const PANEL: Record<AnswerTab, string> = { choose: 'painel-escolher', plan: 'painel-plano' }

/**
 * Tela 5 do pacote 2 (`/resposta`, `/opcoes`, `/plano`): Voltar, título, a safra com a colheita prevista, "Ouvir
 * resumo", as abas "1. Escolher" e "2. Plano de 3 anos" e "Imprimir relatório" (nas duas abas).
 */
export function ChoosePlanView({ t, lang, state }: ChoosePlanViewProps) {
  const c = t.choose
  const choose = state.choose
  return (
    <div className={styles.page}>
      <BackButton to={state.backTo}>{t.nav.back}</BackButton>
      <h1 className={styles.title}>{c.title}</h1>
      <div className={styles.context}>
        <p>{contextText(t, lang, seasonName(CURRENT_SEASON), state.harvest.date, state.harvest.band)}</p>
        <ListenSummary
          supported={state.listen.supported}
          speaking={state.listen.speaking}
          onToggle={state.listen.toggle}
          label={t.listen.summary}
          stopLabel={t.listen.stop}
        />
      </div>
      <div className={styles.tabsRow}>
        <Tabs
          label={c.tabsLabel}
          tabs={[
            { id: 'choose', label: c.tabChoose, panelId: PANEL.choose },
            { id: 'plan', label: c.tabPlan, panelId: PANEL.plan },
          ]}
          selected={state.tab}
          onSelect={state.selectTab}
        />
        {state.status === 'ready' && (
          <button type="button" className={styles.print} onClick={state.print}>
            <PrinterIcon size={17} />
            {c.print}
          </button>
        )}
      </div>
      {state.status === 'loading' && <FlowLoading label={t.common.loading} />}
      {state.status === 'error' && <FlowError t={t} message={t.common.loadError} onRetry={state.retry} />}
      {state.status === 'outside' && <FlowOutside t={t} />}
      {(['choose', 'plan'] as const).map((tab) => (
        <section key={tab} id={PANEL[tab]} role="tabpanel" aria-labelledby={`${PANEL[tab]}-tab`} hidden={state.tab !== tab} className={styles.panel}>
          {state.status === 'ready' && choose && state.tab === tab && (
            tab === 'choose' ? <ChooseTab t={t} lang={lang} state={state} choose={choose} /> : <PlanTab t={t} lang={lang} state={state} choose={choose} />
          )}
        </section>
      ))}
      {state.status === 'ready' && choose && (
        <>
          <WhyModal t={t} lang={lang} state={state} choose={choose} />
          <CellModal t={t} lang={lang} state={state} choose={choose} />
          <ScoreModal t={t} lang={lang} state={state} />
          <PlanReport t={t} lang={lang} state={state} choose={choose} />
        </>
      )}
    </div>
  )
}
