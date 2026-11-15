import { useRef } from 'react'
import { Link } from 'react-router'
import { GuideLink } from '../design-system/components/GuideLink'
import { PlantPhoto } from '../design-system/components/PlantPhoto'
import { ArrowRightIcon, ChartIcon, ClimateIcon, DropIcon, DryIcon, InfoIcon } from '../design-system/icons'
import { plantPhotoProps } from '../content/plantPhotos'
import { SCORE_KEYS, type ChoosePlanState, type ScoreKey } from '../controllers/useChoosePlanController'
import { formatDayMonth, formatFullDate, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { PlanoAvaliado } from '../models/plano'
import type { CropId } from '../models/recomendacao'
import { PLAN_ARTICLES, planBState, rainRows, rainSourceName, signalParts, type PlanCard } from '../services/planService'
import { afterSoyPeriod, CURRENT_SEASON, seasonName } from '../services/seasonService'
import { cropName, joinList } from './choiceTexts'
import { Tag } from './ChooseTab'
import { MissingSeasonsNotice } from './MissingSeasonsNotice'
import styles from './ChoosePlanView.module.css'

type Choose = NonNullable<ChoosePlanState['choose']>

export type PlanTabProps = { t: Messages; lang: Lang; state: ChoosePlanState; choose: Choose }

/** Aba "2. Plano de 3 anos": os 3 anos em cadeia, as notas, a chuva aproveitada e "E se o ano vier seco?". */
export function PlanTab({ t, lang, state, choose }: PlanTabProps) {
  const p = t.choose.plan
  const { cards, evaluation } = state.plan
  return (
    <>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{p.title}</h2>
        <p>{p.intro}</p>
      </div>
      <PlanAlert t={t} state={state} />
      {cards ? (
        <ol aria-label={p.yearsLabel} className={styles.years}>
          {cards.map((card, index) => (
            <YearCard key={card.season} t={t} lang={lang} state={state} choose={choose} card={card} index={index} />
          ))}
        </ol>
      ) : (
        <p className={styles.muted} role="status">
          {evaluation.status === 'error' ? p.error : p.loading}
        </p>
      )}
      <div className={styles.grid2}>
        <Scores t={t} lang={lang} state={state} />
        {evaluation.data?.chuva && <Rain t={t} lang={lang} data={evaluation.data} />}
      </div>
      {evaluation.data && <Dry t={t} lang={lang} state={state} data={evaluation.data} />}
      <div className={styles.next}>
        <p>{p.final}</p>
        <Link to={state.planningTo} className={styles.primary}>
          {p.goPlanning}
          <ArrowRightIcon size={18} />
        </Link>
      </div>
    </>
  )
}

/** O alerta depois de uma troca (`role="status"`), com "Voltar ao plano sugerido" quando o plano foi mudado. */
function PlanAlert({ t, state }: { t: Messages; state: ChoosePlanState }) {
  const p = t.choose.plan
  const { alert, cards, edited } = state.plan
  const season = (index: number) => seasonName(CURRENT_SEASON + index)
  let text = null
  if (alert === 'year1' && cards) {
    text = (
      <>
        {p.alertYear1} <strong>{cropName(t, cards[0].crop)}</strong>. {p.alertYear1After}
      </>
    )
  } else if (alert === 'year2' && cards && edited) {
    text = (
      <>
        {p.alertChanged(season(1))} <strong>{cropName(t, cards[1].crop)}</strong>. {p.alertNext(season(2))}{' '}
        <strong>{cropName(t, cards[2].crop)}</strong>
        {cards[2].motivo ? `: ${cards[2].motivo}.` : '.'}
      </>
    )
  } else if (alert === 'year3' && cards && edited) {
    text = (
      <>
        {p.alertChanged(season(2))} <strong>{cropName(t, cards[2].crop)}</strong>.
      </>
    )
  }
  return (
    <div role="status" aria-live="polite" className={styles.alertSlot}>
      {(text || edited) && (
        <div className={styles.alert}>
          <InfoIcon size={18} />
          <div>
            {text && <p>{text}</p>}
            {edited && (
              <button type="button" className={styles.linkButton} onClick={state.plan.reset}>
                {p.reset}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function YearCard({ t, lang, state, choose, card, index }: PlanTabProps & { card: PlanCard; index: number }) {
  const p = t.choose.plan
  const c = t.choose
  const season = seasonName(card.season)
  const options: CropId[] = [...choose.ranked.map((option) => option.id), 'pousio']
  const option = choose.ranked.find((item) => item.id === card.crop)
  const tag = card.tag === 'choice' ? c.tags.choice : card.tag === 'suggested' ? c.tags.suggestion : c.tags.changed
  const selectId = `ano-${index + 1}`
  const suggested = card.suggested
  const select = useRef<HTMLSelectElement>(null)
  // Trocar (pelo select ou por "Usar a sugestão") grava na URL sem rolar; o foco volta ao select, também sem rolar
  // (o botão "Usar a sugestão" some quando o ano volta para a sugestão).
  const pick = (crop: CropId) => {
    state.plan.chooseYear(index, crop)
    select.current?.focus({ preventScroll: true })
  }
  return (
    <li className={styles.yearCard} data-tag={card.tag}>
      <PlantPhoto {...plantPhotoProps(card.crop, lang)} height={130} className={styles.yearPhoto} />
      <div className={styles.yearBody}>
        <p className={styles.yearSeason}>
          {p.after(season)}
          <small>{afterSoyPeriod(card.season, lang)}</small>
        </p>
        <div className={styles.yearName}>
          <h3>{cropName(t, card.crop)}</h3>
          <Tag kind={card.tag === 'suggested' ? 'suggestion' : card.tag}>{tag}</Tag>
        </div>
        <p className={styles.yearInfo}>
          {card.good !== null && card.total !== null ? p.worked(card.good, card.total) : p.fallow}
          {card.sede && ` · ${t.suggestion.thirst[card.sede]}`}
        </p>
        {card.late && (
          <p className={styles.lateText}>
            {option?.data_limite ? c.compare.deadlineLate(formatDayMonth(lang, option.data_limite)) : c.tags.late}
          </p>
        )}
        {card.motivo && (
          <p className={styles.yearWhy}>
            <strong>{p.why}</strong> {card.motivo}
          </p>
        )}
        <label htmlFor={selectId} className={styles.selectLabel}>
          {p.choose}{' '}
          <span className="visually-hidden">{p.chooseFor(season)}</span>
        </label>
        <select
          ref={select}
          id={selectId}
          className={styles.select}
          value={card.crop}
          onChange={(event) => pick(event.target.value as CropId)}
        >
          {options.map((crop) => (
            <option key={crop} value={crop}>
              {p.option(cropName(t, crop), crop === suggested?.crop, choose.late.has(crop))}
            </option>
          ))}
        </select>
        {suggested && suggested.crop !== card.crop && (
          <p className={styles.yearSuggestion}>
            <Tag kind="suggestion">{c.tags.suggestion}</Tag>
            <span className="visually-hidden">: </span>
            {/* Cultura, ponto e link juntos: numa tela estreita, descem inteiros para a linha de baixo. */}
            <span>
              <strong>{cropName(t, suggested.crop)}</strong> ·{' '}
              <button type="button" className={styles.linkButton} onClick={() => pick(suggested.crop)}>
                {p.useSuggestion}
                <span className="visually-hidden"> ({p.chooseFor(season)})</span>
              </button>
            </span>
          </p>
        )}
      </div>
    </li>
  )
}

/** Notas do plano × "Como é hoje"; cada nota abre o modal com a conta. */
function Scores({ t, lang, state }: { t: Messages; lang: Lang; state: ChoosePlanState }) {
  const s = t.choose.scores
  const plan = state.plan.evaluation
  const today = state.today
  const value = (data: PlanoAvaliado | null, key: ScoreKey) => {
    if (!data) return '…'
    const score = data.notas[key]
    return score === null ? s.none : s.value(formatNumber(lang, Math.round(score)))
  }
  const keys = SCORE_KEYS.filter((key) => key !== 'futuro' || plan.data?.notas.futuro !== null)
  const noSoy =
    today.state.kind === 'noSoy' ? s.noSoy(joinList(today.state.seasons.map((year) => seasonName(year)), t.suggestion.late.and)) : null
  return (
    <section className={styles.box} aria-labelledby="notas-titulo">
      <h3 id="notas-titulo" className={styles.boxTitle}>
        <ChartIcon />
        {s.title}
      </h3>
      <p>{s.sub}</p>
      <table className={styles.scores}>
        <caption className="visually-hidden">{s.label}</caption>
        <thead>
          <tr>
            <td />
            <th scope="col">{s.yours}</th>
            <th scope="col">{s.today}</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((key, index) => (
            <tr key={key}>
              <th scope="row">{s[key]}</th>
              <td>
                <button type="button" className={styles.scoreButton} aria-haspopup="dialog" onClick={() => state.score.onOpen(key)}>
                  {value(plan.data, key)}
                </button>
              </td>
              {today.state.kind === 'crops' ? (
                <td>
                  <button type="button" className={styles.scoreButton} aria-haspopup="dialog" onClick={() => state.score.onOpen(key)}>
                    {value(today.evaluation.data, key)}
                  </button>
                </td>
              ) : today.state.kind === 'missing' ? (
                <td className={styles.notFilled}>{s.notFilled}</td>
              ) : (
                index === 0 && (
                  <td rowSpan={keys.length} className={styles.notFilled}>
                    {noSoy}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {(plan.status === 'loading' || today.evaluation.status === 'loading') && plan.data && (
        <p className={styles.muted}>{t.choose.plan.updating}</p>
      )}
      {today.state.kind === 'missing' && (
        <MissingSeasonsNotice
          t={t}
          lang={lang}
          text={s.missing}
          open={state.seasons.open}
          onOpen={state.seasons.onOpen}
          onClose={state.seasons.onClose}
          form={state.seasons.form}
        />
      )}
    </section>
  )
}

/** "Chuva aproveitada": a chuva com a terra parada e uma barra por ano com o que a lavoura usa. */
function Rain({ t, lang, data }: { t: Messages; lang: Lang; data: PlanoAvaliado }) {
  const r = t.choose.rain
  const rows = rainRows(data, CURRENT_SEASON)
  if (!rows || !data.chuva) return null
  const mm = (value: number) => formatNumber(lang, value)
  const end = formatDayMonth(lang, `${data.chuva.inicio.slice(0, 4)}-${data.chuva.fim}`)
  const pct = (value: number) => `${Math.min(100, (value / Math.max(1, rows.rain)) * 100)}%`
  return (
    <section className={styles.box} aria-labelledby="chuva-titulo">
      <h3 id="chuva-titulo" className={styles.boxTitle}>
        <DropIcon size={18} />
        {r.title}
      </h3>
      <p>{r.text(mm(rows.rain), end)}</p>
      <ul aria-label={r.label} className={styles.rainBars}>
        <li data-fallow="">
          <span>{r.fallow}</span>
          <span className={styles.rainTrack} aria-hidden="true">
            <i style={{ width: '100%' }} />
          </span>
          <strong>{r.fallowValue(mm(rows.rain))}</strong>
        </li>
        {rows.rows.map((row) => (
          <li key={row.season}>
            <span>{r.row(seasonName(row.season), cropName(t, row.crop))}</span>
            <span className={styles.rainTrack} aria-hidden="true">
              <i style={{ width: pct(row.mm) }} />
            </span>
            <strong>{r.mm(mm(row.mm))}</strong>
          </li>
        ))}
      </ul>
      <p className={styles.source}>{r.source(rainSourceName(data.chuva.fonte), data.chuva.anos)}</p>
      <GuideLink slug={PLAN_ARTICLES.water} newTabLabel={t.common.newTab} className={styles.guide}>
        {r.learnMore}
      </GuideLink>
    </section>
  )
}

/** "E se o ano vier seco?": o sinal do outono (NOAA), a orientação de fevereiro e o Plano A / Plano B do motor. */
function Dry({ t, lang, state, data }: { t: Messages; lang: Lang; state: ChoosePlanState; data: PlanoAvaliado }) {
  const d = t.choose.dry
  const signal = state.plan.signal
  const parts = signal ? signalParts(signal.motivo) : null
  const ab = data.plano_ab
  const b = ab ? planBState(ab) : null
  const lower = (crop: CropId) => cropName(t, crop).toLocaleLowerCase(lang)
  return (
    <section className={styles.box} aria-labelledby="seco-titulo">
      <h3 id="seco-titulo" className={styles.boxTitle}>
        <ClimateIcon size={18} />
        {d.title}
      </h3>
      <div className={styles.dryGrid}>
        <div>
          {parts && (
            <p className={styles.signal} data-level={signal?.nivel}>
              <DryIcon size={18} />
              {parts.forecast}
            </p>
          )}
          <p>
            {parts?.history ? `${parts.history} ` : ''}
            {d.check}
          </p>
          {signal?.smap_agora && <p className={styles.muted}>{signal.smap_agora.texto}</p>}
        </div>
        {ab && b && (
          <div className={styles.plans}>
            <div className={styles.planCard} data-plan="a">
              <small>{d.planA}</small>
              <strong>{cropName(t, ab.cultura_a)}</strong>
              <span>{d.ifNormal}</span>
              {ab.cultura_a !== 'pousio' && ab.total > 0 && <span>{d.aWorked(ab.total - ab.falhas_a, ab.total)}</span>}
            </div>
            <div className={styles.planCard} data-plan="b">
              <small>{d.planB}</small>
              {b.kind === 'b' ? (
                <>
                  <strong>{cropName(t, b.crop)}</strong>
                  <span>{d.ifDry}</span>
                  {b.good !== null && <span>{d.bWhy(b.fails, lower(ab.cultura_a), b.good)}</span>}
                </>
              ) : b.kind === 'notNeeded' ? (
                <span>{b.reason === 'pousio' ? d.notNeededFallow : d.notNeeded(cropName(t, ab.cultura_a), ab.total)}</span>
              ) : (
                <span>{d.none(lower(ab.cultura_a))}</span>
              )}
            </div>
          </div>
        )}
      </div>
      {signal && <p className={styles.source}>{d.source(signal.fonte[0] ?? 'NOAA', formatFullDate(lang, signal.data))}</p>}
      <GuideLink slug={PLAN_ARTICLES.dry} newTabLabel={t.common.newTab} className={styles.guide}>
        {d.learnMore}
      </GuideLink>
    </section>
  )
}
