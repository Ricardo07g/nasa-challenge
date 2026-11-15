import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { GuideSlug } from '../content/guia/slugs'
import { plantPhotoProps } from '../content/plantPhotos'
import type { PlanningState } from '../controllers/usePlanningController'
import { BackButton } from '../design-system/components/BackButton'
import { GuideLink } from '../design-system/components/GuideLink'
import { ListenSummary } from '../design-system/components/ListenSummary'
import { PlantPhoto } from '../design-system/components/PlantPhoto'
import {
  ArrowRightIcon,
  BookIcon,
  CheckIcon,
  ClimateIcon,
  CycleIcon,
  DropIcon,
  FireIcon,
  GrainIcon,
  HeavyRainIcon,
  LeafIcon,
  PrinterIcon,
  SproutIcon,
  WatchIcon,
} from '../design-system/icons'
import { formatFullDate } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import { planningAlertText, scenarioName, stepText } from '../i18n/planningTexts'
import type { PlanningAlert, TimelineStep } from '../services/planningService'
import { afterSoyPeriod, seasonName } from '../services/seasonService'
import { FlowError, FlowLoading, FlowOutside } from './FlowStates'
import { futureClimateText, signedDelta } from './futureClimateText'
import { MissingSeasonsNotice } from './MissingSeasonsNotice'
import { PlanReport } from './PlanReport'
import styles from './PlanningView.module.css'

export type PlanningViewProps = { t: Messages; lang: Lang; state: PlanningState }

type Props = PlanningViewProps

/** O lugar com a colheita: "Lavoura de demonstração, perto de Uberlândia (MG) · colheita da soja prevista em …". */
function Context({ t, lang, state }: Props) {
  const p = t.planning
  const place = state.place.demo ? p.demo : state.place.name ? p.place(state.place.name) : null
  const { date, band } = state.harvest
  const harvest = date ? (
    <>
      {p.harvest} <b>{formatFullDate(lang, date)}</b>
    </>
  ) : band ? (
    p.harvestBand(t.harvest[band].inline)
  ) : null
  return (
    <p>
      {place}
      {place && harvest && ' · '}
      {harvest}
    </p>
  )
}

/**
 * Tela 6 "Seu planejamento" (`/planejamento`, pacote 3): a tela final do fluxo. Topo, resumo do plano (3 cartões e
 * as ações), "O que fazer agora", "Alertas da sua área", "Seu plano: o que já aconteceu e o que vem", comunidade
 * "em breve" com o Guia e o relatório, nessa ordem. É a única tela com "Imprimir relatório".
 */
export function PlanningView(props: Props) {
  const { t, lang, state } = props
  const p = t.planning
  const ready = state.status === 'ready'
  return (
    <div className={styles.page}>
      <BackButton to={state.backTo}>{p.back}</BackButton>
      {ready && (
        <p className={styles.ready}>
          <span className={styles.readyIcon}>
            <CheckIcon size={14} />
          </span>
          {p.ready}
        </p>
      )}
      <h1 className={styles.title}>{p.title}</h1>
      {ready && (
        <div className={styles.context}>
          <Context {...props} />
          <ListenSummary
            supported={state.listen.supported}
            speaking={state.listen.speaking}
            onToggle={state.listen.toggle}
            label={t.listen.summary}
            stopLabel={t.listen.stop}
          />
        </div>
      )}
      {state.status === 'loading' && <FlowLoading label={p.loading} />}
      {state.status === 'error' && <FlowError t={t} message={p.error} onRetry={state.retry} />}
      {state.status === 'outside' && <FlowOutside t={t} />}
      {ready && (
        <>
          <PlanSummary {...props} />
          {state.timeline && <Timeline {...props} steps={state.timeline} />}
          <Alerts {...props} />
          <PastFuture {...props} />
          <Community {...props} />
          <ReportCard {...props} />
          <p className={styles.again}>
            {p.again} <Link to={state.newPlanTo}>{p.againLink}</Link>
          </p>
          <PlanReport t={t} lang={lang} state={state} />
        </>
      )}
    </div>
  )
}

function PrintButton({ t, state, className }: Props & { className?: string }) {
  return (
    <button type="button" className={className ?? styles.primary} onClick={state.print}>
      <PrinterIcon size={18} />
      {t.planning.print}
    </button>
  )
}

/** Resumo do plano: um cartão por ano (foto, safra, meses, cultura, deu certo) e o cartão das ações. */
function PlanSummary(props: Props) {
  const { t, lang, state } = props
  const p = t.planning.plan
  const cards = state.plan.cards ?? []
  return (
    <section aria-label={p.label} className={styles.summary}>
      {cards.map((card) => (
        <article key={card.season} className={styles.year}>
          <PlantPhoto {...plantPhotoProps(card.crop, lang)} height={110} className={styles.yearPhoto} />
          <div className={styles.yearText}>
            <p className={styles.yearSeason}>
              {p.after(seasonName(card.season))}
              <span>{afterSoyPeriod(card.season, lang)}</span>
            </p>
            <h3 className={styles.yearCrop}>{t.crops.names[card.crop]}</h3>
            <p className={styles.yearWorked}>{card.good !== null && card.total !== null ? p.worked(card.good, card.total) : p.fallow}</p>
          </div>
        </article>
      ))}
      <div className={styles.actions}>
        <p>{p.actions}</p>
        <PrintButton {...props} />
        <Link to={state.changeTo} className={styles.secondary}>
          {p.change}
        </Link>
      </div>
    </section>
  )
}

const STEP_ICON: Record<TimelineStep['kind'], ReactNode> = {
  now: <WatchIcon size={14} />,
  signal: <ClimateIcon size={14} />,
  harvest: <GrainIcon size={14} />,
  plant: <SproutIcon size={14} />,
  water: <DropIcon size={14} />,
  cropHarvest: <LeafIcon size={14} />,
  next: <CycleIcon size={14} />,
}

/** O jeito do passo: "agora" (marcador cheio), um passo-chave, a fase da água (laranja) ou um passo comum. */
function stepTone(step: TimelineStep, late: boolean): 'now' | 'key' | 'alert' | 'plain' {
  if (step.kind === 'now') return 'now'
  if (step.kind === 'water' || late) return 'alert'
  if (step.kind === 'signal' || step.kind === 'harvest' || step.kind === 'plant') return 'key'
  return 'plain'
}

/** "O que fazer agora": do fim desta soja até a próxima safra (datas da colheita e do prazo do ZARC). */
function Timeline({ t, lang, steps }: Props & { steps: TimelineStep[] }) {
  const p = t.planning.timeline
  return (
    <section aria-labelledby="planejamento-tempo" className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h2 id="planejamento-tempo">{p.title}</h2>
          <p>{p.sub}</p>
        </div>
      </div>
      <ol className={styles.timeline}>
        {steps.map((step) => {
          const text = stepText(t, lang, step)
          return (
            <li key={step.kind} className={styles.step} data-tone={stepTone(step, text.late)} data-late={text.late}>
              <span className={styles.when}>
                {text.when}
                <span>{text.sub}</span>
              </span>
              <span className={styles.marker}>{STEP_ICON[step.kind]}</span>
              <div className={styles.stepCard}>
                <h3>{text.title}</h3>
                <p className={text.late ? styles.lateText : undefined}>{text.text}</p>
                {text.tag && (
                  <span className={styles.tag} data-kind={text.tag.kind}>
                    {text.tag.label}
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

const ALERT_ICON: Record<PlanningAlert['kind'], ReactNode> = {
  now: <ClimateIcon size={14} />,
  heavyRain: <HeavyRainIcon size={14} />,
  fire: <FireIcon size={14} />,
}

/** "Saiba mais" de cada alerta (os slugs reais do Guia); o "Agora" não tem. */
const ALERT_GUIDE: Partial<Record<PlanningAlert['kind'], GuideSlug>> = { heavyRain: 'como-evitar-erosao', fire: 'fogo-na-palha' }

/** "Alertas da sua área": até 3 cartões (cada um só com dado) e a faixa da Defesa Civil. */
function Alerts({ t, lang, state }: Props) {
  const a = t.planning.alerts
  const guideLabel = (kind: PlanningAlert['kind']) => (kind === 'heavyRain' ? a.heavyRain.guide : a.fire.guide)
  return (
    <section aria-labelledby="planejamento-alertas" className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h2 id="planejamento-alertas">{a.title}</h2>
          <p>{a.sub}</p>
        </div>
        <Link to={state.avisosTo} className={styles.arrowLink}>
          {a.seeAll}
          <ArrowRightIcon size={15} />
        </Link>
      </div>
      {state.alerts.length > 0 && (
        <div className={styles.alerts}>
          {state.alerts.map((alert) => {
            const text = planningAlertText(t, lang, alert)
            const guide = ALERT_GUIDE[alert.kind]
            return (
              <article key={alert.kind} className={styles.alert} data-kind={alert.kind}>
                <span className={styles.alertLabel} data-label="">
                  {ALERT_ICON[alert.kind]}
                  {text.label}
                </span>
                <p className={styles.alertText}>{text.text}</p>
                <p>
                  <strong>{a.todo}</strong> {text.todo}
                </p>
                <p className={styles.alertSource}>{a.source(text.source)}</p>
                {guide && (
                  <GuideLink slug={guide} newTabLabel={t.common.newTab} className={styles.guide}>
                    {guideLabel(alert.kind)}
                  </GuideLink>
                )}
              </article>
            )
          })}
        </div>
      )}
      <div className={styles.official}>
        <p>
          <strong>{a.official}</strong> {a.officialText}
        </p>
        <Link to={state.officialTo}>{a.officialLink}</Link>
      </div>
    </section>
  )
}

/** Uma barra "X de 20" (verde no passado, azul no futuro); o número fica escrito ao lado. */
function Bar({ value, total, future, label }: { value: number; total: number; future?: boolean; label: string }) {
  return (
    <span className={styles.bar} data-future={future ? '' : undefined}>
      <span className={styles.barTrack} aria-hidden="true">
        <i style={{ width: `${Math.min(100, (value / Math.max(1, total)) * 100)}%` }} />
      </span>
      {label}
    </span>
  )
}

/** "Seu plano: o que já aconteceu e o que vem": deu certo por ano do plano e o clima de 2041 a 2060. */
function PastFuture({ t, lang, state }: Props) {
  const p = t.planning.past
  const rows = state.pastFuture
  const climate = state.climate
  if (!rows && !climate) return null
  const hasFuture = rows?.some((row) => row.future !== null) ?? false
  const future = climate ? futureClimateText(t, lang, climate) : null
  return (
    <section aria-labelledby="planejamento-passado" className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h2 id="planejamento-passado">{p.title}</h2>
          <p>{p.sub}</p>
        </div>
      </div>
      <div className={styles.pastFuture}>
        {rows && (
          <div className={styles.box}>
            <h3 className={styles.boxTitle}>{p.tableTitle}</h3>
            <table className={styles.pastTable}>
              <thead>
                <tr>
                  <th scope="col">{p.season}</th>
                  <th scope="col">{p.past}</th>
                  {hasFuture && <th scope="col">{p.future}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.season}>
                    <td>
                      <b>{t.crops.names[row.crop]}</b>
                      <small>{seasonName(row.season)}</small>
                    </td>
                    {row.good !== null && row.total !== null ? (
                      <>
                        <td>
                          <Bar value={row.good} total={row.total} label={p.value(row.good, row.total)} />
                        </td>
                        {hasFuture && (
                          <td>
                            {row.future !== null ? (
                              <Bar value={row.future} total={row.total} future label={p.value(Math.round(row.future), row.total)} />
                            ) : (
                              '—'
                            )}
                          </td>
                        )}
                      </>
                    ) : (
                      <td colSpan={hasFuture ? 2 : 1} className={styles.muted}>
                        {p.fallow}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.boxSource}>{p.source(state.rainSource)}</p>
          </div>
        )}
        {climate && future && (
          <div className={styles.box}>
            <h3 className={styles.boxTitle}>{p.climateTitle}</h3>
            <p>{p.climateText}</p>
            <div className={styles.bigNumbers}>
              <div>
                <b>{`${signedDelta(lang, climate.chuva_pct)}%`}</b>
                <span>{p.climateRain}</span>
              </div>
              <div>
                <b>{`${signedDelta(lang, climate.tmax_c)} °C`}</b>
                <span>{p.climateHeat}</span>
              </div>
            </div>
            <p>{future.agreement}</p>
            <GuideLink slug="clima-2041-2060" newTabLabel={t.common.newTab} className={styles.guide}>
              {p.climateGuide}
            </GuideLink>
            <p className={styles.boxSource}>{p.climateSource(scenarioName(climate.cenario))}</p>
          </div>
        )}
      </div>
    </section>
  )
}

/** Comunidade "em breve" (pacote 3) e, enquanto isso, o Guia. Nenhum link para a comunidade. */
function Community({ t, state }: Props) {
  const c = t.planning.community
  return (
    <section aria-labelledby="planejamento-comunidade" className={styles.community}>
      <div>
        <span className={styles.soon}>{c.soon}</span>
        <h2 id="planejamento-comunidade">{c.title}</h2>
        <p>{c.text}</p>
        <ul>
          {c.pills.map((pill) => (
            <li key={pill}>{pill}</li>
          ))}
        </ul>
      </div>
      <div className={styles.communityGuide}>
        <p>{c.guide}</p>
        <Link to={state.guideTo} className={styles.white}>
          <BookIcon size={17} />
          {c.openGuide}
        </Link>
      </div>
    </section>
  )
}

/** O cartão do relatório: o que vai na folha e o "Imprimir relatório"; sem as últimas safras, o "Preencher agora". */
function ReportCard(props: Props) {
  const { t, lang, state } = props
  const r = t.planning.reportCard
  return (
    <section aria-labelledby="planejamento-relatorio" className={styles.reportCard}>
      <div>
        <h2 id="planejamento-relatorio">{r.title}</h2>
        <p>{r.text}</p>
        <ol>
          {r.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        {state.seasons.missing && (
          <div className={styles.missing}>
            <MissingSeasonsNotice
              t={t}
              lang={lang}
              text={r.missing}
              open={state.seasons.open}
              onOpen={state.seasons.onOpen}
              onClose={state.seasons.onClose}
              form={state.seasons.form}
            />
          </div>
        )}
      </div>
      <div className={styles.reportActions}>
        <PrintButton {...props} />
      </div>
    </section>
  )
}
