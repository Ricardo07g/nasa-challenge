import { createPortal } from 'react-dom'
import type { ChoosePlanState } from '../controllers/useChoosePlanController'
import { formatCoordinates, formatFullDate, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { PlanoAvaliado } from '../models/plano'
import type { SeasonAnswer } from '../models/seasonAnswers'
import { planBState, signalParts } from '../services/planService'
import { CURRENT_SEASON, LAST_SEASONS, seasonName } from '../services/seasonService'
import { consTexts, contextText, cropName, deadlineText, futureTexts, joinList, prosTexts, waterTexts } from './choiceTexts'
import styles from './PlanReport.module.css'

type Choose = NonNullable<ChoosePlanState['choose']>

export type PlanReportProps = { t: Messages; lang: Lang; state: ChoosePlanState; choose: Choose }

/**
 * Relatório do planejamento para imprimir (tela 5): "Imprimir relatório" chama `window.print()` e o CSS de
 * impressão esconde o app e mostra só isto. Fica direto no `<body>` (portal), escondido na tela (`hidden`), e
 * sai no idioma da tela. Não é o relatório para o banco.
 */
export function PlanReport(props: PlanReportProps) {
  return createPortal(<Report {...props} />, document.body)
}

function answerText(t: Messages, answer: SeasonAnswer | undefined): string | null {
  const r = t.choose.report
  if (answer === undefined) return null
  if (answer === 'soja') return r.soyOnly
  if (answer === 'sem_soja') return r.noSoy
  return t.seasons.options[answer]
}

function Report({ t, lang, state, choose }: PlanReportProps) {
  const r = t.choose.report
  const c = t.choose
  const s = t.choose.scores
  const plan = state.plan.evaluation.data
  const today = state.today.state.kind === 'crops' ? state.today.evaluation.data : null
  const raio = state.report.raio
  const mm = (value: number) => formatNumber(lang, value)
  const idea = state.report.idea
  const ideaText = !idea ? s.notFilled : idea === 'nao_sei' ? t.seasons.notSure : idea === 'pousio' ? t.seasons.fallowFuture : t.seasons.options[idea]
  const score = (data: PlanoAvaliado | null, key: 'seguranca' | 'solo' | 'futuro') => {
    if (!data) return '—'
    const value = data.notas[key]
    return value === null ? s.none : s.value(formatNumber(lang, Math.round(value)))
  }
  const todayText =
    state.today.state.kind === 'missing'
      ? s.notFilled
      : state.today.state.kind === 'noSoy'
        ? s.noSoy(joinList(state.today.state.seasons.map((year) => seasonName(year)), t.suggestion.late.and))
        : null
  const signal = state.plan.signal
  const ab = plan?.plano_ab ?? null
  const b = ab ? planBState(ab) : null
  return (
    <div className={styles.report} data-print-report="" hidden>
      {/* Um <div>, não <header>: o CSS global de impressão esconde todo <header> (o do app). */}
      <div className={styles.head}>
        <h1>{r.title}</h1>
        <p className={styles.meta}>
          {state.report.demo ? r.demo : r.point}
          {state.report.point && ` · ${formatCoordinates(state.report.point)}`}
        </p>
        <p className={styles.meta}>{contextText(t, lang, seasonName(CURRENT_SEASON), state.harvest.date, state.harvest.band)}</p>
        <p className={styles.meta}>{r.generated(formatFullDate(lang, state.report.generatedOn))}</p>
      </div>

      <section>
        <h2>{r.soil}</h2>
        {raio ? (
          <ul>
            {raio.solo && <li>{r.soilTexture(t.soil[raio.solo.textura], Math.round(raio.solo.argila_pct), mm(raio.solo.cad_mm))}</li>}
            {raio.umidade && <li>{r.soilMoisture(Math.round(raio.umidade.percentil))}</li>}
            {raio.chuva && <li>{r.soilRain(mm(raio.chuva.media_mm))}</li>}
            {raio.veranico && <li>{r.soilDry(raio.veranico.dias, raio.veranico.ano)}</li>}
            {raio.calor && <li>{r.soilHeat(raio.calor.anos_com_calor, raio.calor.total_anos, formatNumber(lang, raio.calor.temp_c))}</li>}
          </ul>
        ) : (
          <p>{r.soilNone}</p>
        )}
      </section>

      <section>
        <h2>{r.seasons}</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">{r.season}</th>
              <th scope="col">{r.after}</th>
            </tr>
          </thead>
          <tbody>
            {LAST_SEASONS.map((year) => (
              <tr key={year}>
                <td>{seasonName(year)}</td>
                <td>{answerText(t, state.report.answers[year]) ?? s.notFilled}</td>
              </tr>
            ))}
            <tr>
              <td>{r.current(seasonName(CURRENT_SEASON))}</td>
              <td>{ideaText}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>{r.options}</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">{r.crop}</th>
              {(['worked', 'water', 'income', 'soil', 'deadline', 'pros', 'cons'] as const).map((row) => (
                <th key={row} scope="col">
                  {c.compare.rows[row]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {choose.columns.map(({ id, option }) => {
              const marks = [id === choose.suggestion.id ? c.tags.suggestion : null, id === choose.choice ? c.tags.choice : null].filter(Boolean)
              const water = option ? waterTexts(t, lang, option) : null
              const future = option ? futureTexts(t, option) : null
              return (
                <tr key={id}>
                  <td>
                    <strong>{cropName(t, id)}</strong>
                    {marks.length > 0 && <div>{marks.join(' · ')}</div>}
                  </td>
                  <td>{option ? c.compare.worked(option.chuva.anos_bons, option.chuva.anos) : c.compare.noCrop}</td>
                  <td>{water ? `${water.main} (${water.dry})` : '—'}</td>
                  <td>
                    {option ? option.renda.texto : c.card.noGrain}
                    {future && <div>{`${c.compare.rows.future}: ${future.main}`}</div>}
                  </td>
                  <td>{option ? option.terra.texto : state.pousioText}</td>
                  <td>{option ? deadlineText(t, lang, option).text : c.compare.noDeadline}</td>
                  <td>{prosTexts(t, option).join('; ') || c.compare.nothing}</td>
                  <td>{consTexts(t, lang, option).join('; ') || c.compare.nothing}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2>{r.plan}</h2>
        {state.plan.cards && (
          <table>
            <thead>
              <tr>
                <th scope="col">{r.season}</th>
                <th scope="col">{r.crop}</th>
                <th scope="col">{c.compare.rows.worked}</th>
                <th scope="col">{r.note}</th>
              </tr>
            </thead>
            <tbody>
              {state.plan.cards.map((card) => (
                <tr key={card.season}>
                  <td>{c.plan.after(seasonName(card.season))}</td>
                  <td>
                    {cropName(t, card.crop)}
                    <div>{card.tag === 'choice' ? c.tags.choice : card.tag === 'suggested' ? c.tags.suggestion : c.tags.changed}</div>
                  </td>
                  <td>{card.good !== null && card.total !== null ? c.compare.worked(card.good, card.total) : c.plan.fallow}</td>
                  <td>{card.motivo ?? (card.late ? c.tags.late : '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <table>
          <thead>
            <tr>
              <td />
              <th scope="col">{s.yours}</th>
              <th scope="col">{s.today}</th>
            </tr>
          </thead>
          <tbody>
            {(['seguranca', 'solo', 'futuro'] as const).map((key) => (
              <tr key={key}>
                <th scope="row">{s[key]}</th>
                <td>{score(plan, key)}</td>
                <td>{todayText ?? score(today, key)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>{r.dry}</h2>
        {signal && (
          <p>
            <strong>{signalParts(signal.motivo).forecast}</strong> {signalParts(signal.motivo).history ?? ''} {c.dry.check}
          </p>
        )}
        {ab && b && (
          <ul>
            <li>{`${c.dry.planA}: ${cropName(t, ab.cultura_a)}, ${c.dry.ifNormal}.`}</li>
            <li>
              {b.kind === 'b'
                ? `${c.dry.planB}: ${cropName(t, b.crop)}, ${c.dry.ifDry}.`
                : b.kind === 'notNeeded'
                  ? `${c.dry.planB}: ${b.reason === 'pousio' ? c.dry.notNeededFallow : c.dry.notNeeded(cropName(t, ab.cultura_a), ab.total)}`
                  : `${c.dry.planB}: ${c.dry.none(cropName(t, ab.cultura_a).toLocaleLowerCase(lang))}`}
            </li>
          </ul>
        )}
        {signal && <p className={styles.meta}>{c.dry.source(signal.fonte[0] ?? 'NOAA', formatFullDate(lang, signal.data))}</p>}
      </section>

      <section>
        <h2>{r.sources}</h2>
        <p>{r.sourcesText}</p>
        <p className={styles.disclaimer}>{r.disclaimer}</p>
      </section>
    </div>
  )
}
