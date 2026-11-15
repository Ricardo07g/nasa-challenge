import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { AlternativeCard, Card } from '../design-system/components/Card'
import { Disclosure, MiniPlan, NumberedSteps, RecommendationHero } from '../design-system/components/Content'
import { MetricRow, StatusPill, ThirstBadge } from '../design-system/components/Status'
import { WaterBar, YearBarsChart } from '../design-system/components/SuggestionCharts'
import { ClimateIcon, CloseIcon, DropIcon, GrainIcon, LeafIcon, ShieldIcon, SoilIcon, SproutIcon, WarningIcon } from '../design-system/icons'
import { PlantImage } from '../design-system/plants/PlantImage'
import type { AnswerNav } from '../controllers/useAnswerNav'
import { formatDayMonth, formatDecimal, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { SafraPassada } from '../models/pastSeason'
import type { AnoDetalhe, CropId, Motivo, Opcao } from '../models/recomendacao'
import type { ScreenStatus } from '../models/screenStatus'
import type { Colheita } from '../models/talhao'
import type { RainEnd } from '../services/rainLeftService'
import type { RainSummary } from '../services/satelliteService'
import {
  SUGGESTION_ARTICLES,
  clearEnsoNotes,
  cropArticle,
  yearBars,
  type LateNotice,
  type Suggestion,
  type YearBar,
} from '../services/suggestionService'
import { AnswerHeader } from './AnswerHeader'
import { FlowError, FlowLoading, FlowOutside } from './FlowStates'
import { rainPeriodText } from './rainPeriod'
import { RainYears } from './RainYears'
import { SeasonTimeline } from './SeasonTimeline'
import { TelegramCard } from './TelegramCard'
import layout from './layout.module.css'
import styles from './AnswerView.module.css'

export type YearState = {
  selected: AnoDetalhe | null
  choose: (year: number | null) => void
  timeline: SafraPassada | null
  timelineStatus: 'loading' | 'ready' | 'error' | null
}

export type AnswerViewProps = {
  t: Messages
  lang: Lang
  nav: AnswerNav
  status: ScreenStatus
  onRetry: () => void
  suggestion: Suggestion | null
  colheita: Colheita | null
  aviso: string
  sampleData: boolean
  /** P5: link do bot do Telegram; null quando não está configurado. */
  telegramHref: string | null
  /** Anos e período da chuva (do talhão), para a legenda do explorador. */
  rain: RainSummary | null
  /** Fim das chuvas na célula (tela 3), para o "O que observar". */
  rainEnd: RainEnd | null
  planTo: string
  year: YearState
}

const MOTIVE_ICON: Record<Motivo, ReactNode> = {
  menos_risco: <ShieldIcon />,
  mais_renda: <GrainIcon />,
  cuidar_da_terra: <LeafIcon />,
}

const PERCENT = 100

/** Número com sinal e uma casa ("+1,3", "−0,7"), com o sinal de menos tipográfico. */
function signed(lang: Lang, value: number): string {
  const text = formatDecimal(lang, Math.abs(value), 1)
  return value < 0 ? `−${text}` : `+${text}`
}

/** "a, b e c" / "a, b and c". */
function joinList(items: readonly string[], and: string): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`
}

function LearnMore({ t, to, title, onDark = false }: { t: Messages; to: string; title: string; onDark?: boolean }) {
  return (
    <Link to={to} className={onDark ? styles.heroLink : layout.iconLink}>
      {t.suggestion.learnMore(title)}
    </Link>
  )
}

function Plant({ t, crop, size }: { t: Messages; crop: CropId; size: number }) {
  return <PlantImage plant={crop} label={t.suggestion.plantImage(t.crops.names[crop])} size={size} />
}

/** Aba Sugestão (seção 5.4 da remodelagem, tarefa 0044). */
export function AnswerView(props: AnswerViewProps) {
  const { t, nav, status, suggestion } = props
  return (
    <div className={layout.page}>
      <AnswerHeader t={t} nav={nav} />
      {status === 'loading' && <FlowLoading label={t.common.loading} />}
      {status === 'error' && <FlowError t={t} message={t.common.loadError} onRetry={props.onRetry} />}
      {status === 'outside' && <FlowOutside t={t} />}
      {status === 'ready' && suggestion && <Ready {...props} suggestion={suggestion} />}
    </div>
  )
}

function Ready(props: AnswerViewProps & { suggestion: Suggestion }) {
  const { t, lang, suggestion, aviso, sampleData, telegramHref, planTo, colheita } = props
  const s = t.suggestion
  const { best } = suggestion
  return (
    <>
      <p className={layout.lead}>{s.lead(suggestion.year)}</p>
      {suggestion.late && <LateCard t={t} lang={lang} late={suggestion.late} colheita={colheita ?? 'tarde'} frost={suggestion.frost} />}
      <div className={layout.pageGrid}>
        <div className={layout.stack}>
          <RecommendationHero
            as="h1"
            label={s.year1}
            title={best.nome}
            media={<Plant t={t} crop={best.id} size={88} />}
            badge={best.agua ? <ThirstBadge level={best.agua.sede}>{s.thirst[best.agua.sede]}</ThirstBadge> : undefined}
          >
            <p>{best.data_limite ? `${t.answer.plantUntil} ${formatDayMonth(lang, best.data_limite)}.` : t.answer.plantSoon}</p>
            <LearnMore t={t} to={cropArticle(best.id)} title={best.nome} onDark />
          </RecommendationHero>
          <section aria-label={s.planTitle} className={layout.stack}>
            <h2 className={layout.cardTitle}>{s.planTitle}</h2>
            <MiniPlan
              label={s.planTitle}
              items={suggestion.plan.map(({ year, crop }) => ({
                year,
                title: t.crops.names[crop],
                media: <Plant t={t} crop={crop} size={56} />,
              }))}
            />
            <Link to={planTo} className={layout.iconLink}>
              {s.explorePlan}
            </Link>
          </section>
          <Rows {...props} />
        </div>
        <div className={layout.stack}>
          <HowTo t={t} lang={lang} option={best} rainEnd={props.rainEnd} />
        </div>
      </div>
      {telegramHref && <TelegramCard t={t} href={telegramHref} />}
      {suggestion.alternatives.length > 0 && (
        <section aria-label={t.answer.prefer} className={layout.stack}>
          <h2 className={layout.sectionTitle}>{t.answer.prefer}</h2>
          <div className={layout.grid}>
            {suggestion.alternatives.map(({ motivo, option, text }) => (
              <AlternativeCard
                key={motivo}
                icon={MOTIVE_ICON[motivo]}
                label={t.motives[motivo]}
                title={option.nome}
                text={text}
                media={<Plant t={t} crop={option.id} size={52} />}
              />
            ))}
          </div>
        </section>
      )}
      <p className={layout.muted}>{sampleData ? `${t.common.sampleValues} ${aviso}` : aviso}</p>
    </>
  )
}

/** Colheita tarde: um aviso só, com a lista montada, a linha do ZARC e a geada quando houve. */
function LateCard({ t, lang, late, colheita, frost }: { t: Messages; lang: Lang; late: LateNotice; colheita: Colheita; frost: Suggestion['frost'] }) {
  const l = t.suggestion.late
  const lower = (name: string) => name.toLocaleLowerCase(lang)
  const when = l.when[colheita]
  const [only] = late.groups
  const text =
    late.groups.length === 1 && only.date
      ? l.textOneDate(when, formatDayMonth(lang, only.date), joinList(only.names.map(lower), l.and), late.count)
      : l.text(
          when,
          joinList(
            late.groups.map((g) => {
              const names = joinList(g.names.map(lower), l.and)
              return g.date ? l.group(names, formatDayMonth(lang, g.date)) : names
            }),
            l.and,
          ),
          late.count,
        )
  return (
    <Card tone="orange" as="section" aria-label={l.title}>
      <h2 className={layout.iconTitle}>
        <WarningIcon size={20} />
        {l.title}
      </h2>
      <p>
        <strong>{text}</strong>
      </p>
      <p>{l.zarc}</p>
      <LearnMore t={t} to={SUGGESTION_ARTICLES.zarc} title={t.suggestion.articles.zarc} />
      {frost && (
        <>
          <p>{l.frost(frost.anos, frost.total, formatNumber(lang, frost.tmin_max_c))}</p>
          <LearnMore t={t} to={SUGGESTION_ARTICLES.frost} title={t.suggestion.articles.frost} />
        </>
      )}
    </Card>
  )
}

function Rows(props: AnswerViewProps & { suggestion: Suggestion }) {
  const { t, lang, suggestion } = props
  const s = t.suggestion
  const { best, future, climate } = suggestion
  return (
    <Card>
      <div>
        <MetricRow
          icon={<DropIcon />}
          iconTone="blue"
          label={s.worked.title}
          value={best.chuva.texto}
          pill={<StatusPill rotulo={best.chuva.rotulo}>{t.labels[best.chuva.rotulo]}</StatusPill>}
        >
          <Worked {...props} />
        </MetricRow>
        {best.agua && (
          <MetricRow icon={<DropIcon />} iconTone="blue" label={s.water.title}>
            <Water t={t} lang={lang} option={best} />
          </MetricRow>
        )}
        {(climate || future) && (
          <MetricRow icon={<ClimateIcon />} iconTone="blue" label={s.climate.title}>
            <div className={styles.rowBody}>
              {climate && (
                <>
                  <p className={styles.facts}>
                    <span>{s.climate.rain(signed(lang, climate.chuva_pct))}</span>
                    <span>{s.climate.heat(signed(lang, climate.tmax_c))}</span>
                  </p>
                  <p>
                    {`${s.climate.agreeRain(climate.concordam_chuva, climate.modelos, climate.chuva_pct < 0)} ${s.climate.agreeHeat(
                      climate.concordam_tmax,
                      climate.modelos,
                      climate.tmax_c >= 0,
                    )}`}
                  </p>
                </>
              )}
              {future && <p>{t.answer.futureYears(future.good, future.total, future.range)}</p>}
              <p className={layout.muted}>{s.climate.source}</p>
              <LearnMore t={t} to={SUGGESTION_ARTICLES.future} title={s.articles.future} />
            </div>
          </MetricRow>
        )}
        <MetricRow
          icon={<GrainIcon />}
          label={t.axes.renda}
          value={best.renda.texto}
          pill={<StatusPill rotulo={best.renda.rotulo}>{t.labels[best.renda.rotulo]}</StatusPill>}
        >
          <span className={layout.muted}>{best.renda.risco}</span>
        </MetricRow>
        <MetricRow
          icon={<SoilIcon />}
          label={t.axes.terra}
          value={best.terra.texto}
          pill={<StatusPill rotulo={best.terra.rotulo}>{t.labels[best.terra.rotulo]}</StatusPill>}
        />
      </div>
      <Disclosure openLabel={t.answer.why} closeLabel={t.answer.close}>
        {best.porque.map((reason) => (
          <p key={reason}>{reason}</p>
        ))}
      </Disclosure>
    </Card>
  )
}

function stateText(t: Messages, bar: YearBar): string {
  const w = t.suggestion.worked
  if (bar.good) return w.good
  if (bar.reason === 'ambos') return w.both
  return bar.reason === 'calor' ? w.heat : w.water
}

/** "Deu certo": o critério do motor, o explorador ano a ano, El Niño / La Niña e o detalhe do ano tocado. */
function Worked(props: AnswerViewProps & { suggestion: Suggestion }) {
  const { t, lang, suggestion, rain, year } = props
  const w = t.suggestion.worked
  const { best } = suggestion
  const criterio = best.criterio
  const explorer = yearBars(best)
  const notes = clearEnsoNotes(best)
  return (
    <div className={styles.rowBody}>
      {criterio && (
        <p>
          {criterio.fase === 'pegamento'
            ? w.criterionCover(Math.round(criterio.isna_min * PERCENT), formatNumber(lang, criterio.calor_temp_c), criterio.calor_min_dias, criterio.janela_dias)
            : w.criterionGrain(Math.round(criterio.isna_min * PERCENT), formatNumber(lang, criterio.calor_temp_c), criterio.calor_min_dias, criterio.janela_dias)}
        </p>
      )}
      <LearnMore t={t} to={SUGGESTION_ARTICLES.worked} title={t.suggestion.articles.worked} />
      {explorer ? (
        <>
          <YearBarsChart
            label={w.chartLabel(best.chuva.anos_bons, best.chuva.anos)}
            bars={explorer.bars.map((bar) => ({
              year: bar.year,
              pct: bar.pct,
              state: bar.good ? 'good' : 'bad',
              mark: bar.enso === 'el_nino' ? w.markNino : bar.enso === 'la_nina' ? w.markNina : null,
              label: w.yearButton(
                bar.year,
                bar.pct,
                stateText(t, bar),
                bar.enso === 'el_nino' ? w.ensoNino : bar.enso === 'la_nina' ? w.ensoNina : '',
              ),
            }))}
            cutPct={explorer.cutPct}
            cutLabel={w.cutLabel(explorer.cutPct)}
            selectedYear={year.selected?.ano ?? null}
            onSelect={year.choose}
          />
          <ul className={styles.legend}>
            <li>
              <span className={styles.legendSwatch} data-state="good" aria-hidden="true" />
              {w.good}
            </li>
            <li>
              <span className={styles.legendSwatch} data-state="bad" aria-hidden="true" />
              {`${w.water} / ${w.heat}`}
            </li>
            <li>{w.legendEnso}</li>
          </ul>
          <p className={layout.muted}>{w.axisNote(rainPeriodText(t, best.chuva.anos, rain))}</p>
          <p className={layout.muted}>{w.tapHint}</p>
        </>
      ) : (
        <RainYears t={t} option={best} />
      )}
      {notes.length > 0 && (
        <div className={styles.note}>
          {notes.map((note) => (
            <p key={note.fase}>{w.ensoNote(w.ensoPhase[note.fase], note.bons, note.anos, note.bons_outros, note.anos_outros)}</p>
          ))}
          <p className={layout.muted}>{w.ensoFew}</p>
          <LearnMore t={t} to={SUGGESTION_ARTICLES.enso} title={t.suggestion.articles.enso} />
        </div>
      )}
      {year.selected && <YearDetail {...props} detail={year.selected} />}
    </div>
  )
}

/** O que aconteceu no ano tocado (a antiga tela `/safra-passada`, agora para qualquer ano). */
function YearDetail({ t, lang, suggestion, year, detail }: AnswerViewProps & { suggestion: Suggestion; detail: AnoDetalhe }) {
  const y = t.suggestion.year
  const w = t.suggestion.worked
  const cover = suggestion.best.criterio?.fase === 'pegamento'
  const temp = formatNumber(lang, suggestion.best.criterio?.calor_temp_c ?? 35)
  const enso = detail.enso === 'el_nino' ? w.ensoNino : detail.enso === 'la_nina' ? w.ensoNina : y.ensoNone
  const facts: { label: string; value: string }[] = [
    ...(detail.semeadura ? [{ label: y.sowing, value: formatDayMonth(lang, detail.semeadura) }] : []),
    { label: cover ? y.establishment : y.flowering, value: formatDayMonth(lang, detail.fase_critica) },
    { label: y.dry, value: y.days(detail.dias_sem_chuva) },
    { label: y.heat(temp), value: y.days(detail.dias_calor ?? 0) },
    { label: y.enso, value: enso },
    ...(detail.umidade_inicial !== null && detail.umidade_inicial !== undefined
      ? [{ label: y.soil, value: y.soilValue(Math.round(detail.umidade_inicial * PERCENT)) }]
      : []),
  ]
  return (
    <section role="region" aria-label={y.title(detail.ano)} aria-live="polite" className={styles.yearPanel}>
      <div className={styles.yearPanelHead}>
        <h3 className={layout.cardTitle}>{y.title(detail.ano)}</h3>
        <button type="button" className={styles.close} onClick={() => year.choose(null)}>
          <CloseIcon size={16} />
          {y.close}
        </button>
      </div>
      <dl className={styles.facts2}>
        {facts.map((fact) => (
          <div key={fact.label} className={styles.fact}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <p>
        <strong>{y.why}: </strong>
        {detail.texto}
      </p>
      {year.timeline && (
        <>
          <h4 className={styles.timelineTitle}>{y.timeline}</h4>
          <SeasonTimeline label={y.timeline} lang={lang} season={year.timeline} />
        </>
      )}
      {year.timelineStatus === 'loading' && <p className={layout.muted}>{t.common.loading}</p>}
      {year.timelineStatus === 'error' && <p className={layout.muted}>{y.timelineError}</p>}
    </section>
  )
}

/** Linha "Água": precisa, costuma chover, falta (normal e seca), 2041–2060 e o porquê. */
function Water({ t, lang, option }: { t: Messages; lang: Lang; option: Opcao }) {
  const w = t.suggestion.water
  const agua = option.agua!
  const mm = (value: number) => formatNumber(lang, value)
  const shortText =
    agua.falta_normal_mm > 0 ? w.short(mm(agua.falta_normal_mm), mm(agua.falta_seco_mm)) : w.noShort(mm(agua.falta_seco_mm))
  const futuro = agua.futuro
  const change = futuro
    ? futuro.mudanca_mm > 0
      ? w.futureMore(mm(futuro.mudanca_mm))
      : futuro.mudanca_mm < 0
        ? w.futureLess(mm(-futuro.mudanca_mm))
        : w.futureSame
    : ''
  return (
    <div className={styles.rowBody}>
      <WaterBar
        rows={[
          { key: 'need', text: w.need(mm(agua.precisa_mm)), mm: agua.precisa_mm },
          { key: 'rain', text: w.rain(mm(agua.chove_mm)), mm: agua.chove_mm },
          { key: 'short', text: shortText, mm: agua.falta_normal_mm },
        ]}
      />
      {futuro && <p>{`${w.future(mm(futuro.falta_normal_mm), mm(futuro.falta_min_mm), mm(futuro.falta_max_mm))} ${change}`}</p>}
      <p>{w.why(mm(agua.cad_mm))}</p>
      <p className={layout.muted}>{w.note(agua.anos)}</p>
      <p className={layout.muted}>{w.guide}</p>
      <LearnMore t={t} to={SUGGESTION_ARTICLES.water} title={t.suggestion.articles.water} />
    </div>
  )
}

/** "Como fazer" em quatro partes: quando plantar, quanto tempo leva, o que observar e manejo. */
function HowTo({ t, lang, option, rainEnd }: { t: Messages; lang: Lang; option: Opcao; rainEnd: RainEnd | null }) {
  const h = t.suggestion.how
  const criterio = option.criterio
  const temp = formatNumber(lang, criterio?.calor_temp_c ?? 35)
  const minDays = criterio?.calor_min_dias ?? 3
  const watch = option.observar
  return (
    <Card tone="green" as="section" aria-label={h.title}>
      <h2 className={layout.iconTitle}>
        <SproutIcon />
        {h.title}
      </h2>
      <div className={styles.howPart}>
        <h3 className={styles.howTitle}>{h.when}</h3>
        <p>{option.data_limite ? h.whenText(formatDayMonth(lang, option.data_limite)) : h.whenSoon}</p>
      </div>
      {option.ciclo && (
        <div className={styles.howPart}>
          <h3 className={styles.howTitle}>{h.duration}</h3>
          <p>{h.durationText(option.ciclo.dias, option.ciclo.floracao_dias)}</p>
        </div>
      )}
      {(watch || rainEnd) && (
        <div className={styles.howPart}>
          <h3 className={styles.howTitle}>{h.watch}</h3>
          <ul className={styles.watchList}>
            {watch && <li>{watch.veranico_dias > 0 ? h.watchDry(watch.veranico_dias) : h.watchDryNone}</li>}
            {watch && (
              <li>
                {watch.anos_calor > 0
                  ? h.watchHeat(watch.anos_calor, watch.total, temp, minDays)
                  : h.watchHeatNone(watch.total, temp, minDays)}
              </li>
            )}
            {rainEnd && <li>{h.watchRainEnd(formatDayMonth(lang, rainEnd.median))}</li>}
          </ul>
        </div>
      )}
      {option.como_fazer.length > 0 && (
        <div className={styles.howPart}>
          <h3 className={styles.howTitle}>{h.manage}</h3>
          <p className={layout.muted}>{h.draft}</p>
          <NumberedSteps steps={option.como_fazer} />
          <p className={layout.muted}>{t.answer.howNote}</p>
        </div>
      )}
      <Link to={cropArticle(option.id)} className={layout.iconLink}>
        {h.fullGuide}
      </Link>
    </Card>
  )
}
