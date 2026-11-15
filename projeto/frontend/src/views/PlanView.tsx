import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '../design-system/components/Button'
import { Card } from '../design-system/components/Card'
import { ChipGroup } from '../design-system/components/Choice'
import { PageHeading, YearTimeline } from '../design-system/components/Content'
import { AnswerTabs, BackLink, type AnswerTab } from '../design-system/components/Navigation'
import { ToneBadge } from '../design-system/components/Status'
import { CalendarIcon, ClimateIcon, CommunityIcon, DropIcon, DryIcon, HistoryIcon, UncertainIcon } from '../design-system/icons'
import { formatDayMonth } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { CropId, NivelSinal, SinalOutono } from '../models/recomendacao'
import type { ScreenStatus } from '../models/screenStatus'
import { PAST_YEARS } from '../services/pastSeasonService'
import type { PlanScenario, PlanView as Plan, PlantingRule } from '../services/recomendacaoRules'
import { FlowError, FlowLoading, FlowOutside } from './FlowStates'
import layout from './layout.module.css'

export type PlanViewProps = {
  t: Messages
  lang: Lang
  nav: { label: string; tabs: AnswerTab[]; backTo: string }
  status: ScreenStatus
  onRetry: () => void
  signal: SinalOutono | null
  scenario: PlanScenario
  onScenario: (value: PlanScenario | null) => void
  rule: PlantingRule | null
  plan: Plan | null
  communityTo: string
  pastTo: string
  /** O estudo do ganho na soja (ilustrativo, sem dado): só com os dados de exemplo. */
  showGainReference: boolean
}

/** Sinal seco = laranja; normal = verde; incerto = azul. */
const SIGNAL_LOOK: Record<NivelSinal, { tone: 'orange' | 'green' | 'blue'; icon: ReactNode }> = {
  seco: { tone: 'orange', icon: <DryIcon /> },
  normal: { tone: 'green', icon: <ClimateIcon /> },
  incerto: { tone: 'blue', icon: <UncertainIcon /> },
}

/** Tela 7 "Plano de 3 anos": sinal do outono e Plano A/B (RF-20) e a linha do tempo. Nenhum valor em reais (tarefa 0040). */
export function PlanView(props: PlanViewProps) {
  const { t, nav, status, onRetry, plan } = props
  const p = t.plan
  return (
    <div className={layout.page}>
      <BackLink to={nav.backTo}>{t.nav.back}</BackLink>
      <AnswerTabs label={nav.label} tabs={nav.tabs} />
      <PageHeading title={p.title} subtitle={p.subtitle} />
      {status === 'loading' && <FlowLoading label={t.common.loading} />}
      {status === 'error' && <FlowError t={t} message={t.common.loadError} onRetry={onRetry} />}
      {status === 'outside' && <FlowOutside t={t} />}
      {status === 'ready' && plan && <Ready {...props} plan={plan} />}
    </div>
  )
}

function Ready(props: PlanViewProps & { plan: Plan }) {
  const { t, lang, signal, scenario, onScenario, plan, rule, communityTo, pastTo, showGainReference } = props
  const p = t.plan
  const name = (crop: CropId) => t.crops.names[crop]
  const lower = (crop: CropId) => name(crop).toLocaleLowerCase(lang)
  const firstYear = plan.years[0]?.year ?? new Date().getFullYear()
  const { grain, covered, total } = plan.summary
  const coverage = covered === total ? p.coveredAll(total) : p.coveredSome(covered, total)
  const ruleText = rule
    ? 'text' in rule
      ? rule.text
      : p.plantingRule(formatDayMonth(lang, rule.date), lower(rule.planA), lower(rule.planB))
    : null

  return (
    <>
      {/* Sem o sinal na API, o bloco do sinal não aparece (decisão D2): fica só a escolha do plano. */}
      <Card as="section" aria-label={signal ? p.signalTitle(firstYear) : p.planChoice}>
        <h2 className={layout.cardTitle}>{signal ? p.signalTitle(firstYear) : p.planChoice}</h2>
        {signal && (
          <>
            <ToneBadge tone={SIGNAL_LOOK[signal.nivel].tone} icon={SIGNAL_LOOK[signal.nivel].icon}>
              {t.signal[signal.nivel]}
            </ToneBadge>
            <p>{signal.motivo}</p>
            {signal.nivel !== 'incerto' && (
              <p>
                <strong>{p.signalMarks(signal.nivel === 'seco' ? p.planB : p.planA)}</strong>
              </p>
            )}
            <p className={layout.muted}>{p.signalSource(signal.fonte[0] ?? '', formatDayMonth(lang, signal.data))}</p>
            {signal.smap_agora && (
              <>
                <p className={layout.iconLine}>
                  <DropIcon />
                  {signal.smap_agora.texto}
                </p>
                <p className={layout.muted}>{p.smapNote}</p>
              </>
            )}
          </>
        )}
        <ChipGroup
          label={p.planChoice}
          options={[
            { value: 'normal', label: p.planA },
            { value: 'seco', label: p.planB },
          ]}
          value={scenario}
          onChange={onScenario}
        />
        {signal?.nivel === 'incerto' && <p className={layout.muted}>{p.keepPlanB}</p>}
        {plan.dryNote && <p className={layout.muted}>{plan.dryNote}</p>}
      </Card>
      <YearTimeline
        label={p.timelineLabel}
        items={plan.years.map(({ year, crop, swappedFrom }) => ({
          year,
          title: name(crop),
          text: swappedFrom ? p.swapTagline(lower(swappedFrom)) : t.crops.taglines[crop],
        }))}
      />
      {ruleText && (
        <Card tone="blue">
          <p className={layout.iconLine}>
            <CalendarIcon />
            <strong>{ruleText}</strong>
          </p>
          {/* A regra da data (tarefa 0038) é pela chuva; sem ela, a regra do dia de plantar é pela terra. */}
          <p className={layout.muted}>{signal?.regra_data ? p.rainRuleNote : p.rootWater}</p>
        </Card>
      )}
      <div className={layout.cta}>
        <Button to={pastTo} variant="outline" icon={<HistoryIcon size={20} />}>
          {t.past.button(PAST_YEARS[0])}
        </Button>
      </div>
      <div className={layout.pageGrid}>
        {/* Sem o estudo ilustrativo (API real), "Com plano" e "Como é hoje" ficam lado a lado. */}
        <div className={showGainReference ? layout.stack : layout.contents}>
          <Card tone="green" as="section" aria-label={p.withPlan}>
            <h3 className={layout.cardTitle}>{p.withPlan}</h3>
            <p>
              {coverage} · {p.grainYears(grain, total)}
            </p>
          </Card>
          <Card tone="orange" as="section" aria-label={p.today}>
            <h3 className={layout.cardTitle}>{p.today}</h3>
            <p>{plan.today}</p>
          </Card>
        </div>
        {showGainReference && (
          <Card tone="green">
            <h2 className={layout.cardTitle}>{p.gainTitle}</h2>
            <p>{p.gainText}</p>
            <p className={layout.muted}>{p.gainNote}</p>
          </Card>
        )}
      </div>
      <Link to={communityTo} className={layout.iconLink}>
        <CommunityIcon />
        {p.regionLink}
      </Link>
    </>
  )
}
