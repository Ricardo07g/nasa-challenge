import { createPortal } from 'react-dom'
import type { PlanningState } from '../controllers/usePlanningController'
import { formatCoordinates, formatFullDate, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import { gainText, planningAlertText, stepText } from '../i18n/planningTexts'
import type { SeasonAnswer } from '../models/seasonAnswers'
import type { LastSeason } from '../services/planningService'
import { CURRENT_SEASON, seasonName } from '../services/seasonService'
import { consTexts, cropName, deadlineText, prosTexts } from './choiceTexts'
import { futureClimateText, signedDelta } from './futureClimateText'
import styles from './PlanReport.module.css'

export type PlanReportProps = { t: Messages; lang: Lang; state: PlanningState }

/**
 * Relatório do planejamento para imprimir (tela 6 `/planejamento`, pacote 3; o único do app): "Imprimir relatório"
 * chama `window.print()` e o CSS de impressão esconde o app e mostra só isto (cerca de 2 folhas A4, margem de
 * 16 mm, cada seção sem quebra). Fica direto no `<body>` (portal), escondido na tela (`hidden`), e sai no idioma da
 * tela. As 7 seções: Sua terra, Últimas safras, Opções comparadas, Plano de 3 anos (com prós, contras e "Como o
 * plano ajuda a ganhar"), O que fazer e quando, Alertas e clima, Fontes e aviso.
 */
export function PlanReport(props: PlanReportProps) {
  return createPortal(<Report {...props} />, document.body)
}

function answerText(t: Messages, answer: SeasonAnswer): string {
  const r = t.planning.report
  if (answer === 'soja') return r.soyOnly
  if (answer === 'sem_soja') return r.noSoy
  return t.seasons.options[answer]
}

function seasonText(t: Messages, season: LastSeason): string {
  const r = t.planning.report
  if (season.kind === 'answer') return answerText(t, season.answer)
  if (season.kind === 'satellite') return r.satellite[season.seen]
  return r.notFilled
}

function Report({ t, lang, state }: PlanReportProps) {
  const r = t.planning.report
  const c = t.choose
  const raio = state.raio
  const mm = (value: number) => formatNumber(lang, value)
  const choose = state.choose
  const idea = state.seasons.idea
  const ideaText = !idea ? r.notFilled : idea === 'nao_sei' ? t.seasons.notSure : idea === 'pousio' ? t.seasons.fallowFuture : t.seasons.options[idea]
  const place = state.place.demo ? r.demo : state.place.name ? r.place(state.place.name) : r.point
  const { date, band } = state.harvest
  const climate = state.climate
  const future = climate ? futureClimateText(t, lang, climate) : null
  const cards = state.plan.cards ?? []
  return (
    <div className={styles.report} data-print-report="" hidden>
      {/* Um <div>, não <header>: o CSS global de impressão esconde todo <header> (o do app). */}
      <div className={styles.head}>
        <h1>{r.title}</h1>
        <p className={styles.meta}>
          {place}
          {state.place.point && ` · ${formatCoordinates(state.place.point)}`}
        </p>
        {(date || band) && (
          <p className={styles.meta}>{date ? r.harvest(formatFullDate(lang, date)) : r.harvestBand(t.harvest[band!].inline)}</p>
        )}
        <p className={styles.meta}>{r.generated(formatFullDate(lang, state.generatedOn))}</p>
      </div>

      <section>
        <h2>{r.soil}</h2>
        {raio && (raio.solo || raio.umidade || raio.chuva || raio.veranico) ? (
          <ul>
            {raio.solo && <li>{r.soilTexture(t.soil[raio.solo.textura], Math.round(raio.solo.argila_pct), mm(raio.solo.cad_mm))}</li>}
            {raio.umidade && <li>{r.soilMoisture(Math.round(raio.umidade.percentil))}</li>}
            {raio.chuva && <li>{r.soilRain(mm(raio.chuva.media_mm))}</li>}
            {raio.veranico && <li>{r.soilDry(raio.veranico.dias, raio.veranico.ano)}</li>}
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
            {state.seasons.list.map((season) => (
              <tr key={season.year}>
                <td>{seasonName(season.year)}</td>
                <td>{seasonText(t, season)}</td>
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
        {choose && (
          <table>
            <thead>
              <tr>
                <th scope="col">{r.crop}</th>
                <th scope="col">{r.worked}</th>
                <th scope="col">{r.income}</th>
                <th scope="col">{r.deadline}</th>
              </tr>
            </thead>
            <tbody>
              {choose.columns.map(({ id, option }) => {
                const deadline = option ? deadlineText(t, lang, option) : null
                const marks = [
                  id === choose.choice ? c.tags.choice : null,
                  id === choose.suggestion.id ? c.tags.suggestion : null,
                  deadline?.late ? c.tags.late : null,
                ].filter(Boolean)
                return (
                  <tr key={id}>
                    <td>
                      <strong>{cropName(t, id)}</strong>
                      {marks.length > 0 && <div>{marks.join(' · ')}</div>}
                    </td>
                    <td>{option ? c.compare.worked(option.chuva.anos_bons, option.chuva.anos) : c.compare.noCrop}</td>
                    <td>{option ? (option.renda.da_grao ? r.grain : r.noGrain) : '—'}</td>
                    <td>{deadline ? deadline.text : c.compare.noDeadline}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>{r.plan}</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">{t.planning.past.season}</th>
              <th scope="col">{t.planning.past.past}</th>
              <th scope="col">{t.planning.past.future}</th>
              <th scope="col">{r.pros}</th>
              <th scope="col">{r.cons}</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card, index) => {
              const row = state.pastFuture?.[index]
              const option = card.crop === 'pousio' ? null : state.optionOf(card.crop)
              const value = (good: number | null | undefined) =>
                good === null || good === undefined || !row?.total ? '—' : t.planning.past.value(Math.round(good), row.total)
              return (
                <tr key={card.season}>
                  <td>
                    <strong>{cropName(t, card.crop)}</strong>
                    <div>{t.planning.plan.after(seasonName(card.season))}</div>
                  </td>
                  <td>{card.crop === 'pousio' ? t.planning.past.fallow : value(row?.good)}</td>
                  <td>{card.crop === 'pousio' ? t.planning.past.fallow : value(row?.future)}</td>
                  <td>{prosTexts(t, option).join('; ') || c.compare.nothing}</td>
                  <td>{consTexts(t, lang, option).join('; ') || c.compare.nothing}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {state.gain && (
          <p>
            <strong>{r.gain.title}</strong> {gainText(t, state.gain)}
          </p>
        )}
      </section>

      <section>
        <h2>{r.todo}</h2>
        {state.timeline && (
          <table>
            <thead>
              <tr>
                <th scope="col">{r.when}</th>
                <th scope="col">{r.step}</th>
              </tr>
            </thead>
            <tbody>
              {state.timeline.map((step) => {
                const text = stepText(t, lang, step)
                return (
                  <tr key={step.kind}>
                    <td className={styles.when}>
                      <strong>{text.when}</strong> {text.sub}
                    </td>
                    <td>
                      <strong>{text.title}</strong>
                      <div>{text.text}</div>
                      {text.tag?.kind === 'planB' && <div>{text.tag.label}</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>{r.alerts}</h2>
        {state.alerts.length > 0 ? (
          <ul>
            {state.alerts.map((alert) => {
              const text = planningAlertText(t, lang, alert)
              return (
                <li key={alert.kind}>
                  <strong>{text.label}:</strong> {text.text} {t.planning.alerts.todo} {text.todo} ({t.planning.alerts.source(text.source)})
                </li>
              )
            })}
          </ul>
        ) : (
          <p>{r.alertsNone}</p>
        )}
        {climate && future && <p>{r.climate(signedDelta(lang, climate.chuva_pct), signedDelta(lang, climate.tmax_c), future.agreement)}</p>}
      </section>

      <section>
        <h2>{r.sources}</h2>
        <p>{r.sourcesText}</p>
        <p className={styles.disclaimer}>{r.disclaimer}</p>
      </section>
    </div>
  )
}
