import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '../design-system/components/Button'
import { Card } from '../design-system/components/Card'
import { SelectField } from '../design-system/components/Choice'
import { CompareTable } from '../design-system/components/Compare'
import { PageHeading } from '../design-system/components/Content'
import { ThirstBadge, ToneBadge } from '../design-system/components/Status'
import { ClimateIcon, CommunityIcon, DropIcon, DryIcon, LeafIcon, UncertainIcon } from '../design-system/icons'
import { PlantImage } from '../design-system/plants/PlantImage'
import type { AnswerNav } from '../controllers/useAnswerNav'
import type { Evaluation, TodayState } from '../controllers/usePlanController'
import { formatDayMonth, formatDecimal, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import { CULTURAS_RELATO } from '../models/community'
import type { PlanoAB, PlanoAvaliado } from '../models/plano'
import type { CropId, NivelSinal, Opcao, Sede, SinalOutono } from '../models/recomendacao'
import type { ScreenStatus } from '../models/screenStatus'
import { PLAN_ARTICLES, rainSourceName, type TodayRow } from '../services/planService'
import { AnswerHeader } from './AnswerHeader'
import { QuestionChips } from './CommunityForms'
import { FlowError, FlowLoading, FlowOutside } from './FlowStates'
import layout from './layout.module.css'
import styles from './PlanView.module.css'

export type PlanState = {
  years: { year: number; crop: CropId }[]
  choices: CropId[]
  edited: boolean
  thirst: Partial<Record<CropId, Sede>>
  options: Opcao[]
}

export type PlanViewProps = {
  t: Messages
  lang: Lang
  nav: AnswerNav
  status: ScreenStatus
  onRetry: () => void
  signal: SinalOutono | null
  plan: PlanState | null
  evaluation: Evaluation
  today: TodayState | null
  onChooseCrop: (index: number, crop: CropId) => void
  onReset: () => void
  onAnswerToday: (year: number, crop: CropId | null) => void
  communityTo: string
}

/** Sinal seco = laranja; normal = verde; incerto = azul. */
const SIGNAL_LOOK: Record<NivelSinal, { tone: 'orange' | 'green' | 'blue'; icon: ReactNode }> = {
  seco: { tone: 'orange', icon: <DryIcon /> },
  normal: { tone: 'green', icon: <ClimateIcon /> },
  incerto: { tone: 'blue', icon: <UncertainIcon /> },
}

/** "O que foi?": as culturas do `culturas.yaml` e "Deixei parado" (as mesmas do relato de plantio da S7). */
const TODAY_CROPS = CULTURAS_RELATO.filter((crop): crop is CropId => crop !== 'outra')

/** "a, b e c" / "a, b and c". */
function joinList(items: readonly string[], and: string): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`
}

function LearnMore({ t, to, title }: { t: Messages; to: string; title: string }) {
  return (
    <Link to={to} className={layout.iconLink}>
      {t.suggestion.learnMore(title)}
    </Link>
  )
}

/** Aba "Plano de 3 anos" (seção 5.6 da remodelagem, tarefa 0045): o produtor monta a rotação. */
export function PlanView(props: PlanViewProps) {
  const { t, nav, status, onRetry, plan } = props
  return (
    <div className={layout.page}>
      <AnswerHeader t={t} nav={nav} />
      <PageHeading title={t.plan.title} subtitle={t.rotation.subtitle} />
      <LearnMore t={t} to={PLAN_ARTICLES.rotation} title={t.suggestion.articles.rotation} />
      {status === 'loading' && <FlowLoading label={t.common.loading} />}
      {status === 'error' && <FlowError t={t} message={t.common.loadError} onRetry={onRetry} />}
      {status === 'outside' && <FlowOutside t={t} />}
      {status === 'ready' && plan && <Ready {...props} plan={plan} />}
    </div>
  )
}

function Ready(props: PlanViewProps & { plan: PlanState }) {
  const { t, evaluation, today, communityTo } = props
  const data = evaluation.data
  return (
    <>
      <Years {...props} />
      <div className={layout.pageGrid}>
        <div className={layout.stack}>
          <Scores {...props} />
          {data && <Soil t={t} lang={props.lang} data={data} />}
        </div>
        <div className={layout.stack}>{today && <Today {...props} today={today} />}</div>
      </div>
      {data?.chuva && <Rain {...props} data={data} />}
      {props.signal && <Signal {...props} signal={props.signal} />}
      {data?.plano_ab && <PlanAB t={t} lang={props.lang} ab={data.plano_ab} source={data.chuva?.fonte ?? null} />}
      <Link to={communityTo} className={layout.iconLink}>
        <CommunityIcon />
        {t.plan.regionLink}
      </Link>
    </>
  )
}

/** Os 3 anos, cada um com a imagem, o selo de sede, "deu certo" e a escolha da cultura. */
function Years({ t, plan, onChooseCrop, onReset }: PlanViewProps & { plan: PlanState }) {
  const r = t.rotation
  const name = (crop: CropId) => t.crops.names[crop]
  return (
    <section aria-label={r.yearsLabel} className={layout.stack}>
      <ol aria-label={r.yearsLabel} className={styles.years}>
        {plan.years.map(({ year, crop }, index) => {
          const option = plan.options.find((item) => item.id === crop)
          const sede = plan.thirst[crop]
          return (
            <li key={`${year}-${index}`} className={styles.year}>
              <div className={styles.yearHead}>
                <span className={styles.yearTile}>{year}</span>
                <PlantImage plant={crop} label={t.suggestion.plantImage(name(crop))} size={56} />
                <span className={styles.yearText}>
                  <strong className={styles.yearName}>{name(crop)}</strong>
                  {sede && <ThirstBadge level={sede}>{t.suggestion.thirst[sede]}</ThirstBadge>}
                  <span className={layout.muted}>
                    {option ? r.yearWorked(option.chuva.anos_bons, option.chuva.anos) : crop === 'pousio' ? r.yearFallow : ''}
                  </span>
                </span>
              </div>
              <SelectField
                label={r.choose(year)}
                value={crop}
                options={plan.choices.map((choice) => ({ value: choice, label: name(choice) }))}
                onChange={(value) => onChooseCrop(index, value)}
              />
            </li>
          )
        })}
      </ol>
      {plan.edited ? (
        <div className={styles.editedLine}>
          <p>{r.edited}</p>
          <Button variant="outline" fullWidth={false} onClick={onReset}>
            {r.reset}
          </Button>
        </div>
      ) : (
        <p className={layout.muted}>{r.suggested}</p>
      )}
    </section>
  )
}

/** Notas do plano ao lado do "Como é hoje" (0 a 100), com o último resultado enquanto recalcula. */
function Scores({ t, lang, evaluation, today }: PlanViewProps) {
  const r = t.rotation
  const value = (data: PlanoAvaliado | null | undefined, key: 'seguranca' | 'solo' | 'futuro') => {
    if (!data) return '…'
    const score = data.notas[key]
    return score === null ? r.scoreNone : r.score(formatNumber(lang, Math.round(score)))
  }
  const todayData = today?.evaluation.data
  const loading = evaluation.status === 'loading' || today?.evaluation.status === 'loading'
  const keys = ['seguranca', 'solo', 'futuro'] as const
  const visible = keys.filter((key) => key !== 'futuro' || evaluation.data?.notas.futuro !== null)
  return (
    <Card as="section" aria-label={r.scoresTitle}>
      <h2 className={layout.cardTitle}>{r.scoresTitle}</h2>
      {loading && (
        <p role="status" className={layout.muted}>
          {r.updating}
        </p>
      )}
      {evaluation.status === 'error' && !evaluation.data && <p className={layout.muted}>{r.scoresError}</p>}
      <CompareTable
        caption={r.scoresLabel}
        columns={[
          { key: 'plan', title: r.yourPlan },
          { key: 'today', title: r.today },
        ]}
        rows={visible.map((key) => ({ label: r.scores[key], cells: [value(evaluation.data, key), value(todayData, key)] }))}
      />
      <p className={layout.muted}>{r.scoresNote}</p>
    </Card>
  )
}

/** Saúde da terra da rotação inteira, com fatos. */
function Soil({ t, lang, data }: { t: Messages; lang: Lang; data: PlanoAvaliado }) {
  const r = t.rotation
  const terra = data.terra
  const lower = (crop: CropId) => t.crops.names[crop].toLocaleLowerCase(lang)
  return (
    <Card as="section" aria-label={r.soilTitle} tone="green">
      <h2 className={layout.iconTitle}>
        <LeafIcon />
        {r.soilTitle}
      </h2>
      <ul className={styles.facts}>
        <li>{r.covered(terra.anos_cobertos, terra.total)}</li>
        <li>{r.nitrogen(terra.anos_nitrogenio)}</li>
        <li>{r.nematode(terra.anos_nematoide)}</li>
        <li>{terra.repetidas.length ? r.repeat(joinList(terra.repetidas.map(lower), r.and)) : r.noRepeat}</li>
      </ul>
      {terra.bonus_diversidade > 0 && <p className={layout.muted}>{r.bonus(formatNumber(lang, terra.bonus_diversidade))}</p>}
    </Card>
  )
}

/** "Chuva aproveitada": a frase do pedido, cada ano do plano e o "Como é hoje". */
function Rain({ t, lang, plan, today, data }: PlanViewProps & { plan: PlanState; data: PlanoAvaliado }) {
  const r = t.rotation
  const chuva = data.chuva!
  const mm = (value: number) => formatNumber(lang, value)
  const lower = (name: string) => name.toLocaleLowerCase(lang)
  const anyCrop = data.anos.some((ano) => ano.cultura !== 'pousio')
  const todayUse = today?.evaluation.data?.chuva?.usa_media_mm
  return (
    <Card as="section" aria-label={r.rainTitle} tone="blue">
      <h2 className={layout.iconTitle}>
        <DropIcon />
        {r.rainTitle}
      </h2>
      <p>
        <strong>
          {anyCrop && chuva.usa_media_mm !== null
            ? r.rainSentence(mm(chuva.chuva_mm), mm(chuva.usa_media_mm))
            : r.rainFallowOnly(mm(chuva.chuva_mm))}
        </strong>
      </p>
      <ul className={styles.facts}>
        {data.anos.map((ano, index) => {
          const year = plan.years[index]?.year ?? index + 1
          const text =
            ano.cultura === 'pousio'
              ? r.rainYearFallow(year, mm(chuva.chuva_mm))
              : ano.usa_mm === null
                ? r.rainYearOut(year, lower(ano.nome))
                : r.rainYear(year, lower(ano.nome), mm(ano.usa_mm))
          return <li key={`${year}-${index}`}>{text}</li>
        })}
      </ul>
      {todayUse !== null && todayUse !== undefined && <p>{r.rainToday(mm(todayUse))}</p>}
      <p className={layout.muted}>{r.rainNote(rainSourceName(chuva.fonte), formatDayMonth(lang, chuva.inicio), chuva.anos)}</p>
      <LearnMore t={t} to={PLAN_ARTICLES.water} title={t.suggestion.articles.water} />
    </Card>
  )
}

/** Sinal para o outono (RF-20): a previsão do El Niño / La Niña e a umidade de agora, só para informar. */
function Signal({ t, lang, plan, signal }: PlanViewProps & { plan: PlanState; signal: SinalOutono }) {
  const p = t.plan
  const firstYear = plan.years[0]?.year ?? 0
  return (
    <Card as="section" aria-label={p.signalTitle(firstYear)}>
      <h2 className={layout.cardTitle}>{p.signalTitle(firstYear)}</h2>
      <ToneBadge tone={SIGNAL_LOOK[signal.nivel].tone} icon={SIGNAL_LOOK[signal.nivel].icon}>
        {t.signal[signal.nivel]}
      </ToneBadge>
      <p>{signal.motivo}</p>
      {signal.nivel !== 'incerto' && (
        <p>
          <strong>{p.signalMarks(signal.nivel === 'seco' ? 'Plano B' : p.planA)}</strong>
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
    </Card>
  )
}

/** Plano A e Plano B numa frase cada; o número de "secar" só quando a série separa bem. */
function PlanAB({ t, lang, ab, source }: { t: Messages; lang: Lang; ab: PlanoAB; source: string | null }) {
  const r = t.rotation
  const lower = (name: string) => name.toLocaleLowerCase(lang)
  const a = lower(ab.nome_a)
  const limite = ab.limite
  let rule: string | null = null
  if (ab.cultura_b && limite?.separa) rule = r.planBRule(formatNumber(lang, limite.chuva_mm), limite.dias)
  return (
    <Card as="section" aria-label={r.abTitle} tone="orange">
      <h2 className={layout.cardTitle}>{r.abTitle}</h2>
      <p>
        <strong>{ab.cultura_a === 'pousio' ? r.planAFallow : r.planA(a)}</strong>
      </p>
      {ab.cultura_b && ab.nome_b && (
        <>
          <p>
            <strong>{r.planB(lower(ab.nome_b))}</strong>
          </p>
          {rule && limite ? (
            <>
              <p>{rule}</p>
              <p className={layout.muted}>{r.planBEvidence(limite.falhas_marcadas, limite.falhas, a, limite.total)}</p>
            </>
          ) : limite?.motivo === 'poucas_falhas' ? (
            <p>{r.planBFewFails(a, ab.falhas_a, ab.total)}</p>
          ) : (
            <p>{r.planBNoNumber(limite?.dias ?? 15, a, ab.total)}</p>
          )}
          {ab.b_bons_nas_falhas !== null && (
            <p className={layout.muted}>{r.planBWhy(ab.falhas_a, a, ab.b_bons_nas_falhas, lower(ab.nome_b))}</p>
          )}
        </>
      )}
      {ab.motivo === 'nunca_falhou' && <p>{r.planBNever(a, ab.total)}</p>}
      {ab.motivo === 'nenhuma_melhor' && <p>{r.planBNone(a)}</p>}
      {source && <p className={layout.muted}>{r.planBSource(rainSourceName(source))}</p>}
      <LearnMore t={t} to={PLAN_ARTICLES.dry} title={r.articleDry} />
    </Card>
  )
}

/** "Como é hoje": o NDVI das 3 últimas safras, a confirmação e "O que foi?". */
function Today({ t, lang, today, onAnswerToday }: PlanViewProps & { today: TodayState }) {
  const r = t.rotation
  const planted = today.rows.filter((row) => row.seen === 'plantou').map((row) => String(row.year))
  const intro = !today.hasSatellite ? r.todayAsk : planted.length ? r.todaySeen(joinList(planted, r.and)) : r.todayNotSeen
  const names = today.crops.map((crop) => t.crops.names[crop].toLocaleLowerCase(lang))
  return (
    <Card as="section" aria-label={r.todayTitle}>
      <h2 className={layout.cardTitle}>{r.todayTitle}</h2>
      {today.rows.length > 0 && <p>{intro}</p>}
      {today.rows.map((row) => (
        <TodayQuestion key={row.year} t={t} lang={lang} row={row} onAnswer={onAnswerToday} />
      ))}
      <p className={layout.muted}>{today.reference ? r.todayReference(today.referenceText) : r.todayYours}</p>
      <p>{r.todayCrops(joinList(names, r.and))}</p>
    </Card>
  )
}

function TodayQuestion({ t, lang, row, onAnswer }: { t: Messages; lang: Lang; row: TodayRow; onAnswer: PlanViewProps['onAnswerToday'] }) {
  const r = t.rotation
  const status = [
    row.seen ? r.todayStatus[row.seen] : null,
    row.byProducer ? r.todayYou : null,
    row.ndvi !== null && row.seen ? r.todayNdvi(formatDecimal(lang, row.ndvi, 2)) : null,
  ].filter(Boolean)
  return (
    <div className={styles.todayRow}>
      <p className={styles.todayYear}>
        <strong>{row.year}</strong>
        {status.length > 0 && <span className={layout.muted}>{` · ${status.join(' · ')}`}</span>}
      </p>
      <QuestionChips
        label={r.todayYear(row.year)}
        options={TODAY_CROPS.map((crop) => ({ value: crop, label: t.community.reportCrops[crop] }))}
        value={row.value}
        onChange={(crop) => onAnswer(row.year, crop)}
        allowDeselect
      />
    </div>
  )
}
