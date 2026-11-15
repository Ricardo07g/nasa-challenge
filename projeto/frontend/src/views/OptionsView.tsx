import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { AlternativeCard } from '../design-system/components/Card'
import { CompareTable, CropPicker, type CompareTableRow } from '../design-system/components/Compare'
import { PageHeading } from '../design-system/components/Content'
import { StatusPill, ThirstBadge } from '../design-system/components/Status'
import { GrainIcon, LeafIcon, ShieldIcon } from '../design-system/icons'
import { PlantImage } from '../design-system/plants/PlantImage'
import type { AnswerNav } from '../controllers/useAnswerNav'
import { formatDayMonth, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { CropId, Motivo, Opcao } from '../models/recomendacao'
import type { ScreenStatus } from '../models/screenStatus'
import { COMPARE_ARTICLES, failureCounts, whyAvoid, whyUse, type CompareChip } from '../services/compareService'
import { futureSummary } from '../services/recomendacaoRules'
import { cropArticle, type Suggestion } from '../services/suggestionService'
import { AnswerHeader } from './AnswerHeader'
import { FlowError, FlowLoading, FlowOutside } from './FlowStates'
import layout from './layout.module.css'
import styles from './OptionsView.module.css'

export type CompareState = {
  chips: CompareChip[]
  columns: Opcao[]
  selected: CropId[]
  best: CropId | null
  full: boolean
  alternatives: Suggestion['alternatives']
}

export type OptionsViewProps = {
  t: Messages
  lang: Lang
  nav: AnswerNav
  status: ScreenStatus
  onRetry: () => void
  compare: CompareState | null
  onToggle: (crop: CropId) => void
  onCompareWith: (crop: CropId) => void
  planLink: (crop: CropId) => string
}

const MOTIVE_ICON: Record<Motivo, ReactNode> = {
  menos_risco: <ShieldIcon />,
  mais_renda: <GrainIcon />,
  cuidar_da_terra: <LeafIcon />,
}

const DASH = '—'

/** "a, b e c" / "a, b and c". */
function joinList(items: readonly string[], and: string): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`
}

function Plant({ t, crop, name, size }: { t: Messages; crop: CropId; name: string; size: number }) {
  return <PlantImage plant={crop} label={t.suggestion.plantImage(name)} size={size} />
}

/** Aba Comparar (seção 5.5 da remodelagem, tarefa 0045): até 3 culturas lado a lado. */
export function OptionsView(props: OptionsViewProps) {
  const { t, nav, status, onRetry, compare } = props
  return (
    <div className={layout.page}>
      <AnswerHeader t={t} nav={nav} />
      <PageHeading title={t.suggestion.compareTitle} subtitle={t.compare.lead} />
      {status === 'loading' && <FlowLoading label={t.common.loading} />}
      {status === 'error' && <FlowError t={t} message={t.common.loadError} onRetry={onRetry} />}
      {status === 'outside' && <FlowOutside t={t} />}
      {status === 'ready' && compare && <Ready {...props} compare={compare} />}
    </div>
  )
}

function Ready(props: OptionsViewProps & { compare: CompareState }) {
  const { t, lang, compare, onToggle, onCompareWith } = props
  const c = t.compare
  const anyLate = compare.chips.some((chip) => chip.disabled)
  return (
    <>
      {compare.alternatives.length > 0 && (
        <section aria-label={c.preferTitle} className={layout.stack}>
          <h2 className={layout.sectionTitle}>{c.preferTitle}</h2>
          <p className={layout.muted}>{c.preferHint}</p>
          <div className={layout.grid}>
            {compare.alternatives.map(({ motivo, option, text }) => (
              <AlternativeCard
                key={motivo}
                icon={MOTIVE_ICON[motivo]}
                label={t.motives[motivo]}
                title={option.nome}
                text={text}
                media={<Plant t={t} crop={option.id} name={option.nome} size={52} />}
                action={
                  <button type="button" className={styles.action} onClick={() => onCompareWith(option.id)}>
                    {c.preferAction(option.nome)}
                  </button>
                }
              />
            ))}
          </div>
        </section>
      )}
      <section aria-label={c.pickLabel} className={layout.stack}>
        <h2 className={layout.cardTitle}>{c.pickLabel}</h2>
        <p className={layout.muted}>{compare.full ? c.full : c.pickHint}</p>
        <CropPicker
          label={c.pickLabel}
          items={compare.chips.map((chip) => ({
            value: chip.id,
            label: chip.nome,
            selected: chip.selected,
            disabled: chip.disabled,
            note: chip.disabled ? (chip.limit ? c.lateChip(formatDayMonth(lang, chip.limit)) : c.lateChipNoDate) : undefined,
            media: <Plant t={t} crop={chip.id} name={chip.nome} size={40} />,
            badge: chip.sede ? <ThirstBadge level={chip.sede}>{t.suggestion.thirst[chip.sede]}</ThirstBadge> : undefined,
          }))}
          onToggle={(value) => onToggle(value as CropId)}
        />
        {anyLate && <p className={layout.muted}>{c.lateNote}</p>}
      </section>
      <CompareTable
        caption={c.tableLabel(joinList(compare.columns.map((option) => option.nome), t.rotation.and))}
        columns={compare.columns.map((option) => ({
          key: option.id,
          title: option.nome,
          media: <Plant t={t} crop={option.id} name={option.nome} size={56} />,
          badge: option.agua ? <ThirstBadge level={option.agua.sede}>{t.suggestion.thirst[option.agua.sede]}</ThirstBadge> : undefined,
        }))}
        rows={rows(props)}
      />
      <p className={layout.muted}>
        {c.soilGuide}{' '}
        <Link to={COMPARE_ARTICLES.straw}>{c.articles.straw}</Link>
        {' · '}
        <Link to={COMPARE_ARTICLES.greenManure}>{c.articles.greenManure}</Link>
        {' · '}
        <Link to={COMPARE_ARTICLES.nematode}>{c.articles.nematode}</Link>
      </p>
      <p className={layout.muted}>{c.source}</p>
    </>
  )
}

/** As linhas do pedido, na ordem; a linha sem dado em nenhuma coluna não aparece (decisão D2). */
function rows({ t, lang, compare, planLink }: OptionsViewProps & { compare: CompareState }): CompareTableRow[] {
  const c = t.compare
  const options = compare.columns
  const mm = (value: number) => formatNumber(lang, value)
  const list = (items: string[]) =>
    items.length ? (
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    ) : (
      <span className={layout.muted}>{c.nothing}</span>
    )
  const result: (CompareTableRow | null)[] = [
    {
      label: c.rows.worked,
      cells: options.map((option) => (
        <>
          <p>{c.worked(option.chuva.anos_bons, option.chuva.anos)}</p>
          <StatusPill rotulo={option.chuva.rotulo}>{t.labels[option.chuva.rotulo]}</StatusPill>
        </>
      )),
    },
    options.some((option) => failureCounts(option))
      ? {
          label: c.rows.failed,
          cells: options.map((option) => {
            const counts = failureCounts(option)
            if (!counts) return DASH
            if (counts.failed === 0) return c.failedNone
            return (
              <>
                <p>{c.failedWater(counts.water)}</p>
                <p>{c.failedHeat(counts.heat)}</p>
              </>
            )
          }),
        }
      : null,
    options.some((option) => option.agua)
      ? {
          label: c.rows.water,
          cells: options.map((option) =>
            option.agua ? (
              <>
                <p>{c.waterNeed(mm(option.agua.precisa_mm))}</p>
                <p>{c.waterRain(mm(option.agua.chove_mm))}</p>
                <p>{c.waterShort(mm(option.agua.falta_normal_mm), mm(option.agua.falta_seco_mm))}</p>
              </>
            ) : (
              DASH
            ),
          ),
        }
      : null,
    options.some((option) => option.futuro)
      ? {
          label: c.rows.future,
          cells: options.map((option) => {
            const future = futureSummary(option)
            if (!future) return DASH
            return (
              <>
                <p>{c.future(future.good, future.total)}</p>
                {future.range && <p className={layout.muted}>{c.futureRange(future.range.min, future.range.max)}</p>}
              </>
            )
          }),
        }
      : null,
    {
      label: c.rows.income,
      cells: options.map((option) => (
        <>
          <p>{option.renda.texto}</p>
          <p className={layout.muted}>{option.renda.risco}</p>
          <StatusPill rotulo={option.renda.rotulo}>{t.labels[option.renda.rotulo]}</StatusPill>
        </>
      )),
    },
    {
      label: c.rows.soil,
      cells: options.map((option) => (
        <>
          <p>{option.terra.texto}</p>
          <StatusPill rotulo={option.terra.rotulo}>{t.labels[option.terra.rotulo]}</StatusPill>
        </>
      )),
    },
    {
      label: c.rows.deadline,
      cells: options.map((option) => (option.data_limite ? c.deadline(formatDayMonth(lang, option.data_limite)) : c.deadlineNone)),
    },
    { label: c.rows.use, cells: options.map((option) => list(whyUse(option).map((key) => c.use[key]))) },
    { label: c.rows.avoid, cells: options.map((option) => list(whyAvoid(option).map((key) => c.avoid[key]))) },
    {
      label: c.rows.more,
      cells: options.map((option) => (
        <div key={option.id} className={styles.more}>
          <Link to={cropArticle(option.id)} className={layout.iconLink}>
            {t.suggestion.learnMore(option.nome)}
          </Link>
          <Link to={planLink(option.id)} className={styles.use} aria-label={c.usePlanLabel(option.nome)}>
            {c.usePlan}
          </Link>
        </div>
      )),
    },
  ]
  return result.filter((row): row is CompareTableRow => row !== null)
}
