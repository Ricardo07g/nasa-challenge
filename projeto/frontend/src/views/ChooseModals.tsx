import { NumberedSteps } from '../design-system/components/Content'
import { GuideLink } from '../design-system/components/GuideLink'
import { Modal } from '../design-system/components/Modal'
import { WaterBar, YearBarsChart } from '../design-system/components/SuggestionCharts'
import { CloseIcon } from '../design-system/icons'
import type { ChoosePlanState, CompareRow, ScoreKey } from '../controllers/useChoosePlanController'
import { formatDayMonth, formatFullDate, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { PlanoAvaliado } from '../models/plano'
import type { AnoDetalhe, Opcao } from '../models/recomendacao'
import { failureCounts } from '../services/compareService'
import { isLate } from '../services/choiceService'
import { CURRENT_SEASON, seasonName } from '../services/seasonService'
import { clearEnsoNotes, yearBars, type YearBar } from '../services/suggestionService'
import { consTexts, CROP_GUIDE, cropName, deadlineText, futureTexts, prosTexts, waterTexts } from './choiceTexts'
import { futureClimateText } from './futureClimateText'
import { SeasonTimeline } from './SeasonTimeline'
import styles from './ChoosePlanView.module.css'

type Choose = NonNullable<ChoosePlanState['choose']>
type ModalProps = { t: Messages; lang: Lang; state: ChoosePlanState; choose: Choose }

const PERCENT = 100

/** O dia de plantar da conta (logo depois da colheita), por extenso. */
function sowingText(lang: Lang, state: ChoosePlanState): string {
  const day = state.harvest.date ?? state.harvest.sowing
  return day ? formatFullDate(lang, day) : ''
}

function stateText(t: Messages, bar: YearBar): string {
  const w = t.suggestion.worked
  if (bar.good) return w.good
  if (bar.reason === 'ambos') return w.both
  return bar.reason === 'calor' ? w.heat : w.water
}

/** Modal grande "Por que essa sugestão?": deu certo ano a ano, água, clima, renda e terra, como fazer, saiba mais. */
export function WhyModal({ t, lang, state, choose }: ModalProps) {
  const c = t.choose
  const option = choose.suggestion
  return (
    <Modal
      open={state.why.open}
      onClose={state.why.onClose}
      title={cropName(t, option.id)}
      subtitle={c.why.subtitle(sowingText(lang, state))}
      closeLabel={t.common.close}
      size="large"
    >
      <div className={styles.whyGrid}>
        <WorkedBlock t={t} lang={lang} state={state} option={option} />
        {option.agua && <WaterBlock t={t} lang={lang} option={option} />}
        {(option.futuro || state.climate) && <ClimateBlock t={t} lang={lang} state={state} option={option} />}
        <section className={styles.block} aria-labelledby="por-que-renda">
          <h3 id="por-que-renda" className={styles.blockTitle}>
            {c.why.incomeSoil}
          </h3>
          <p>
            <strong>{option.renda.texto}.</strong> {option.renda.risco}
          </p>
          <p>{option.terra.texto}</p>
          <ProsCons t={t} lang={lang} option={option} />
        </section>
        {option.como_fazer.length > 0 && (
          <section className={styles.block} aria-labelledby="por-que-como">
            <h3 id="por-que-como" className={styles.blockTitle}>
              {c.why.how}
            </h3>
            <p className={styles.howNote}>{t.suggestion.how.note}</p>
            <NumberedSteps steps={option.como_fazer} />
          </section>
        )}
        <section className={styles.block} aria-labelledby="por-que-saiba">
          <h3 id="por-que-saiba" className={styles.blockTitle}>
            {c.why.learnMore}
          </h3>
          <ul className={styles.guideList}>
            <li>
              <GuideLink slug="deu-certo" newTabLabel={t.common.newTab}>
                {t.suggestion.learnMore(t.suggestion.articles.worked)}
              </GuideLink>
            </li>
            <li>
              <GuideLink slug={CROP_GUIDE[option.id]} newTabLabel={t.common.newTab}>
                {t.suggestion.learnMore(cropName(t, option.id))}
              </GuideLink>
            </li>
            <li>
              <GuideLink slug="clima-2041-2060" newTabLabel={t.common.newTab}>
                {t.suggestion.learnMore(t.suggestion.articles.future)}
              </GuideLink>
            </li>
          </ul>
        </section>
      </div>
    </Modal>
  )
}

function ProsCons({ t, lang, option }: { t: Messages; lang: Lang; option: Opcao | null }) {
  const c = t.choose.compare
  const pros = prosTexts(t, option)
  const cons = consTexts(t, lang, option)
  return (
    <div className={styles.prosCons}>
      <div>
        <h4>{c.rows.pros}</h4>
        <ul className={styles.list}>{pros.length ? pros.map((item) => <li key={item}>{item}</li>) : <li>{c.nothing}</li>}</ul>
      </div>
      <div>
        <h4>{c.rows.cons}</h4>
        <ul className={styles.list}>{cons.length ? cons.map((item) => <li key={item}>{item}</li>) : <li>{c.nothing}</li>}</ul>
      </div>
    </div>
  )
}

/** "Deu certo ano a ano": o critério do motor, as 20 barras (N = El Niño), e o que aconteceu no ano tocado. */
function WorkedBlock({ t, lang, state, option }: { t: Messages; lang: Lang; state: ChoosePlanState; option: Opcao }) {
  const w = t.suggestion.worked
  const criterio = option.criterio
  const explorer = yearBars(option)
  const notes = clearEnsoNotes(option)
  return (
    <section className={styles.block} aria-labelledby="por-que-deu-certo">
      <h3 id="por-que-deu-certo" className={styles.blockTitle}>
        {t.choose.why.worked}
      </h3>
      <p>
        <strong>{t.choose.card.worked(option.chuva.anos_bons, option.chuva.anos)}.</strong>{' '}
        {criterio &&
          (criterio.fase === 'pegamento'
            ? w.criterionCover(Math.round(criterio.isna_min * PERCENT), formatNumber(lang, criterio.calor_temp_c), criterio.calor_min_dias, criterio.janela_dias)
            : w.criterionGrain(Math.round(criterio.isna_min * PERCENT), formatNumber(lang, criterio.calor_temp_c), criterio.calor_min_dias, criterio.janela_dias))}
      </p>
      {explorer && (
        <>
          <YearBarsChart
            label={w.chartLabel(option.chuva.anos_bons, option.chuva.anos)}
            bars={explorer.bars.map((bar) => ({
              year: bar.year,
              pct: bar.pct,
              state: bar.good ? 'good' : 'bad',
              mark: bar.enso === 'el_nino' ? w.markNino : bar.enso === 'la_nina' ? w.markNina : null,
              label: w.yearButton(bar.year, bar.pct, stateText(t, bar), bar.enso === 'el_nino' ? w.ensoNino : bar.enso === 'la_nina' ? w.ensoNina : ''),
            }))}
            cutPct={explorer.cutPct}
            cutLabel={w.cutLabel(explorer.cutPct)}
            selectedYear={state.why.year.selected?.ano ?? null}
            onSelect={state.why.year.choose}
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
          <p className={styles.muted}>{w.tapHint}</p>
        </>
      )}
      {notes.map((note) => (
        <p key={note.fase}>{w.ensoNote(w.ensoPhase[note.fase], note.bons, note.anos, note.bons_outros, note.anos_outros)}</p>
      ))}
      {state.why.year.selected && <YearDetail t={t} lang={lang} state={state} option={option} detail={state.why.year.selected} />}
      <p className={styles.source}>{t.choose.cell.workedSource}</p>
    </section>
  )
}

/** O que aconteceu no ano tocado: datas, veranico, calor, El Niño, umidade do SMAP e a safra dia a dia. */
function YearDetail({ t, lang, state, option, detail }: { t: Messages; lang: Lang; state: ChoosePlanState; option: Opcao; detail: AnoDetalhe }) {
  const y = t.suggestion.year
  const w = t.suggestion.worked
  const cover = option.criterio?.fase === 'pegamento'
  const temp = formatNumber(lang, option.criterio?.calor_temp_c ?? 35)
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
        <h4>{y.title(detail.ano)}</h4>
        <button type="button" className={styles.linkButton} onClick={() => state.why.year.choose(null)}>
          <CloseIcon size={16} />
          {y.close}
        </button>
      </div>
      <dl className={styles.facts}>
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <p>
        <strong>{y.why}: </strong>
        {detail.texto}
      </p>
      {state.why.year.timeline && <SeasonTimeline label={y.timeline} lang={lang} season={state.why.year.timeline} />}
      {state.why.year.timelineStatus === 'loading' && <p className={styles.muted}>{t.common.loading}</p>}
      {state.why.year.timelineStatus === 'error' && <p className={styles.muted}>{y.timelineError}</p>}
    </section>
  )
}

function WaterBlock({ t, lang, option }: { t: Messages; lang: Lang; option: Opcao }) {
  const w = t.suggestion.water
  const agua = option.agua!
  const mm = (value: number) => formatNumber(lang, value)
  const shortText = agua.falta_normal_mm > 0 ? w.short(mm(agua.falta_normal_mm), mm(agua.falta_seco_mm)) : w.noShort(mm(agua.falta_seco_mm))
  return (
    <section className={styles.block} aria-labelledby="por-que-agua">
      <h3 id="por-que-agua" className={styles.blockTitle}>
        {t.choose.why.water}
      </h3>
      <WaterBar
        rows={[
          { key: 'need', text: w.need(mm(agua.precisa_mm)), mm: agua.precisa_mm },
          { key: 'rain', text: w.rain(mm(agua.chove_mm)), mm: agua.chove_mm },
          { key: 'short', text: shortText, mm: agua.falta_normal_mm },
        ]}
      />
      <p>{w.why(mm(agua.cad_mm))}</p>
      <p className={styles.source}>{t.choose.cell.waterSource}</p>
      <GuideLink slug="conta-de-agua" newTabLabel={t.common.newTab}>
        {t.suggestion.learnMore(t.suggestion.articles.water)}
      </GuideLink>
    </section>
  )
}

function ClimateBlock({ t, lang, state, option }: { t: Messages; lang: Lang; state: ChoosePlanState; option: Opcao }) {
  const climate = state.climate && futureClimateText(t, lang, state.climate)
  const future = option.futuro
  return (
    <section className={styles.block} aria-labelledby="por-que-clima">
      <h3 id="por-que-clima" className={styles.blockTitle}>
        {t.choose.why.climate}
      </h3>
      {future && (
        <p>
          <strong>{t.choose.cell.futureText(Math.round(future.anos_bons_media), option.chuva.anos, future.anos_bons_min, future.anos_bons_max)}</strong>
        </p>
      )}
      {climate && (
        <p>
          {climate.rain} {climate.heat} {climate.agreement}
        </p>
      )}
      <p className={styles.source}>{t.choose.cell.futureSource}</p>
    </section>
  )
}

/** O conteúdo do modal de uma célula: o número, a explicação e a fonte. */
function cellDetail(t: Messages, lang: Lang, state: ChoosePlanState, option: Opcao | null, row: CompareRow) {
  const c = t.choose.cell
  const r = t.choose.compare
  if (row === 'pros' || row === 'cons') return { value: null, text: null, prosCons: true, source: c.engineSource, late: false }
  if (!option) {
    const text = row === 'soil' ? state.pousioText : row === 'income' ? t.choose.card.noGrain : c.fallow
    return { value: null, text, prosCons: false, source: c.engineSource, late: false }
  }
  const mm = (value: number) => formatNumber(lang, value)
  if (row === 'worked') {
    const fails = failureCounts(option)
    return {
      value: r.worked(option.chuva.anos_bons, option.chuva.anos),
      text: `${c.workedText}${fails && fails.failed > 0 ? ` ${c.workedFails(fails.water, fails.heat)}` : ''}`,
      prosCons: false,
      source: c.workedSource,
      late: false,
    }
  }
  if (row === 'water') {
    const agua = option.agua
    return {
      value: waterTexts(t, lang, option)?.main ?? null,
      text: agua ? c.waterText(mm(agua.precisa_mm), mm(agua.chove_mm), mm(agua.falta_normal_mm), mm(agua.falta_seco_mm), mm(agua.cad_mm)) : null,
      prosCons: false,
      source: c.waterSource,
      late: false,
    }
  }
  if (row === 'future') {
    const future = option.futuro
    return {
      value: futureTexts(t, option)?.main ?? null,
      text: future ? c.futureText(Math.round(future.anos_bons_media), option.chuva.anos, future.anos_bons_min, future.anos_bons_max) : null,
      prosCons: false,
      source: c.futureSource,
      late: false,
    }
  }
  if (row === 'income') return { value: option.renda.texto, text: `${option.renda.risco} ${c.incomeText}`, prosCons: false, source: c.engineSource, late: false }
  if (row === 'soil') return { value: t.labels[option.terra.rotulo], text: `${option.terra.texto} ${c.soilText}`, prosCons: false, source: c.engineSource, late: false }
  const late = isLate(option)
  const sowing = sowingText(lang, state)
  const limit = option.data_limite ? formatFullDate(lang, option.data_limite) : null
  return {
    value: deadlineText(t, lang, option).text,
    text: !limit ? c.deadlineNone : late ? c.deadlineLate(limit, sowing) : c.deadlineOk(limit, sowing),
    prosCons: false,
    source: c.deadlineSource,
    late,
    zarc: true,
  }
}

/** Modal de uma célula da comparação (todo número que precisa de explicação abre um modal com a fonte). */
export function CellModal({ t, lang, state, choose }: ModalProps) {
  const open = state.cell.open
  const column = open ? choose.columns.find((item) => item.id === open.crop) : null
  const option = open ? (column?.option ?? choose.ranked.find((item) => item.id === open.crop) ?? null) : null
  const detail = open ? cellDetail(t, lang, state, option, open.row) : null
  const title = open ? (open.row === 'pros' || open.row === 'cons' ? t.choose.cell.prosCons : t.choose.compare.rows[open.row]) : ''
  return (
    <Modal open={Boolean(open)} onClose={state.cell.onClose} title={title} subtitle={open ? cropName(t, open.crop) : undefined} closeLabel={t.common.close}>
      {open && detail && (
        <div className={styles.cellDetail}>
          {detail.value && <p className={styles.detailValue}>{detail.value}</p>}
          {detail.text && <p>{detail.text}</p>}
          {detail.prosCons && <ProsCons t={t} lang={lang} option={option} />}
          {detail.late && option && <p className={styles.warning}>{consTexts(t, lang, option)[0]}</p>}
          {'zarc' in detail && detail.zarc && <p>{t.choose.cell.zarc}</p>}
          <p className={styles.source}>{detail.source}</p>
          {'zarc' in detail && detail.zarc && (
            <GuideLink slug="prazo-de-plantio-zarc" newTabLabel={t.common.newTab}>
              {t.suggestion.learnMore(t.suggestion.articles.zarc)}
            </GuideLink>
          )}
        </div>
      )}
    </Modal>
  )
}

function yearLines(t: Messages, data: PlanoAvaliado | null): string[] {
  const s = t.choose.scores
  if (!data) return []
  return data.anos.map((ano, index) => {
    const season = seasonName(CURRENT_SEASON + index)
    if (ano.cultura === 'pousio') return s.yearFallow(season)
    const worked = ano.anos_bons !== null && ano.total_anos !== null ? t.choose.plan.worked(ano.anos_bons, ano.total_anos).toLocaleLowerCase() : ''
    return s.yearLine(season, cropName(t, ano.cultura), worked)
  })
}

/** Modal de uma nota do plano: a regra da conta, os anos do plano e a nota de "Como é hoje". */
export function ScoreModal({ t, lang, state }: Omit<ModalProps, 'choose'>) {
  const s = t.choose.scores
  const key: ScoreKey | null = state.score.open
  const plan = state.plan.evaluation.data
  const today = state.today.state.kind === 'crops' ? state.today.evaluation.data : null
  const value = (data: PlanoAvaliado | null) => {
    if (!data || !key) return '…'
    const score = data.notas[key]
    return score === null ? s.none : s.value(formatNumber(lang, Math.round(score)))
  }
  return (
    <Modal open={key !== null} onClose={state.score.onClose} title={key ? s[key] : ''} closeLabel={t.common.close}>
      {key && (
        <div className={styles.cellDetail}>
          <p className={styles.detailValue}>{`${s.yours}: ${value(plan)}`}</p>
          <ul className={styles.list}>
            {yearLines(t, plan).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {today && (
            <>
              <p className={styles.detailSub}>{`${s.today}: ${value(today)}`}</p>
              <ul className={styles.list}>
                {yearLines(t, today).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          )}
          <p>{s.rules[key]}</p>
          {key === 'solo' && plan && plan.terra.bonus_diversidade > 0 && <p>{s.bonus(formatNumber(lang, plan.terra.bonus_diversidade))}</p>}
          <p className={styles.source}>{s.source}</p>
        </div>
      )}
    </Modal>
  )
}
