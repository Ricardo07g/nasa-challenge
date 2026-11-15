import type { ReactNode } from 'react'
import { Button } from '../design-system/components/Button'
import { ProgressBar } from '../design-system/components/Feedback'
import { BackLink } from '../design-system/components/Navigation'
import {
  CheckIcon,
  ClimateIcon,
  DropIcon,
  HistoryIcon,
  LayersIcon,
  LockIcon,
  SatelliteIcon,
  SoilIcon,
  StarIcon,
} from '../design-system/icons'
import { formatDecimal } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { ScreenStatus } from '../models/screenStatus'
import type { MissionFacts } from '../services/missionService'
import { FlowOutside } from './FlowStates'
import styles from './MissionView.module.css'

export type MissionViewProps = {
  t: Messages
  lang: Lang
  status: ScreenStatus
  /** Quantas fases já terminaram (0 a 6). */
  phase: number
  complete: boolean
  facts: MissionFacts | null
  place: string | null
  weak: boolean
  reducedMotion: boolean
  spins: number
  backTo: string
  continueTo: string
  onSpin: () => void
  onWait: () => void
  onRetry: () => void
}

const PHASE_ICONS: ReactNode[] = [
  <SatelliteIcon key="satellite" />,
  <SoilIcon key="soil" />,
  <DropIcon key="rain" />,
  <HistoryIcon key="history" />,
  <ClimateIcon key="climate" />,
  <LayersIcon key="options" />,
]

/**
 * O dado real que cada fase mostra quando termina; `extra` é um segundo dado da mesma fase, mostrado à
 * parte (a previsão do outono no clima que vem). Sem o dado na API, a fase fica sem resultado (null):
 * nada de "Ainda não conectado" (decisão D2). A última não revela a melhor opção.
 */
type PhaseResult = { text: string; extra?: string }

function phaseResults(t: Messages, lang: Lang, facts: MissionFacts | null): (PhaseResult | null)[] {
  const m = t.mission
  if (!facts) return []
  const period = facts.future?.period
  const future = facts.future ? (period ? m.future(period.start, period.end) : m.futureRead) : null
  const forecast = facts.signal ? m.forecast(t.signal[facts.signal].toLocaleLowerCase(lang)) : null
  const nextClimate = future ? { text: future, extra: forecast ?? undefined } : forecast ? { text: forecast } : null
  return [
    { text: m.found(formatDecimal(lang, facts.point.lat, 2), formatDecimal(lang, facts.point.lon, 2)) },
    { text: t.satellite.soilTitle(t.soil[facts.soil]) },
    facts.rainYears !== null ? { text: m.rain(facts.rainYears) } : null,
    facts.historyYears !== null ? { text: m.history(facts.historyYears) } : null,
    nextClimate,
    { text: m.ready },
  ]
}

/** Tela de cálculo "Missão: sua lavoura" (RF-19): cena do satélite à esquerda, diário da missão à direita. */
export function MissionView(props: MissionViewProps) {
  const { t, lang, status, phase, complete, facts, place, weak, reducedMotion, backTo, continueTo } = props
  const m = t.mission
  const results = phaseResults(t, lang, facts)

  if (status === 'outside') {
    return (
      <div className={styles.page}>
        <BackLink to={backTo}>{t.nav.back}</BackLink>
        <h1 className={styles.title}>{m.title}</h1>
        <FlowOutside t={t} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <BackLink to={backTo}>{t.nav.back}</BackLink>
      <div className={styles.layout} data-reduced={reducedMotion}>
        {!reducedMotion && <MissionScene {...props} results={results} />}
        <section className={styles.panel} aria-label={m.title}>
          <p className={styles.eyebrow}>
            <SatelliteIcon size={18} />
            {t.start.nasaData}
          </p>
          <h1 className={styles.title}>{m.title}</h1>
          {place && <p className={styles.place}>{t.where.near(place)}</p>}
          <ProgressBar label={m.title} value={phase} max={6} />
          <strong className={styles.count}>{m.collected(phase)}</strong>
          <ol className={styles.log}>
            {m.phases.map((label, index) => {
              const state = index < phase ? 'done' : index === phase ? 'current' : 'locked'
              return (
                <li key={label} className={styles.logItem} data-state={state}>
                  <span className={styles.logIcon}>
                    {state === 'done' ? <CheckIcon size={21} /> : state === 'current' ? PHASE_ICONS[index] : <LockIcon />}
                  </span>
                  <span>
                    <span>{label}</span>
                    {state === 'done' && results[index] && <PhaseResultLine result={results[index]} />}
                  </span>
                </li>
              )
            })}
          </ol>
          <p className="visually-hidden" aria-live="polite" aria-atomic="true">
            {complete ? m.complete : `${m.phases[phase] ?? ''}. ${phase > 0 ? (results[phase - 1]?.text ?? '') : m.intro}`}
          </p>
          {(weak || status === 'error') && (
            <div className={styles.status}>
              <p>{status === 'error' ? t.satellite.error : m.weak}</p>
              {status === 'error' ? (
                <Button variant="outline" onClick={props.onRetry}>
                  {t.common.retry}
                </Button>
              ) : (
                <Button variant="outline" onClick={props.onWait}>
                  {m.wait}
                </Button>
              )}
              <Button to="/exemplo" variant="outline">
                {t.where.seeExample}
              </Button>
            </div>
          )}
          {complete && (
            <div className={styles.finish}>
              <span className={styles.stars} aria-hidden="true">
                <StarIcon />
                <StarIcon />
                <StarIcon />
              </span>
              <h2 className={styles.finishTitle}>{m.complete}</h2>
              <Button to={continueTo} arrow>
                {m.continue}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

/** O resultado de uma fase no diário: o dado em negrito (e o segundo dado da fase, se houver). */
function PhaseResultLine({ result }: { result: PhaseResult }) {
  return (
    <>
      <strong className={styles.logResult}>{result.text}</strong>
      {result.extra && <strong className={styles.logResult}>{result.extra}</strong>}
    </>
  )
}

/** Cena animada (só CSS). Mostra o que cada fase está fazendo; tocar no satélite só faz ele girar. */
function MissionScene({ t, phase, complete, spins, onSpin, status, results }: MissionViewProps & { results: (PhaseResult | null)[] }) {
  const m = t.mission
  const lastResult = phase > 0 && !complete ? results[phase - 1] : null
  return (
    <div className={styles.scene} data-phase={phase} data-error={status === 'error'}>
      <svg viewBox="0 0 800 620" className={styles.sceneSvg} aria-hidden="true" focusable="false">
        <rect width="800" height="620" className={styles.sky} />
        <path d="M-80 65 Q400 -180 880 65" className={styles.orbit} />
        {Array.from({ length: 22 }, (_, index) => (
          <circle key={index} cx={(index * 137 + 50) % 800} cy={(index * 67 + 38) % 230} r={index % 3 === 0 ? 2 : 1} className={styles.star} />
        ))}
        <g transform="translate(105 305)" className={styles.field}>
          {Array.from({ length: 40 }, (_, index) => (
            <rect
              key={index}
              x={(index % 10) * 59}
              y={Math.floor(index / 10) * 50}
              width="55"
              height="45"
              rx="3"
              className={styles.plot}
              style={{ animationDelay: `${(index % 10) * 0.08}s` }}
            />
          ))}
        </g>
        <g className={styles.reticle}>
          <circle cx="400" cy="398" r="46" />
          <path d="M400 340v22m0 72v22m-58-58h22m72 0h22" />
        </g>
        <path d="M400 410c-15-20-27-32-27-46a27 27 0 0 1 54 0c0 14-12 26-27 46Z" className={styles.pin} />
        <circle cx="400" cy="364" r="8" className={styles.pinDot} />
        {phase === 1 && <path d="M400 205 115 480H685Z" className={styles.beam} />}
        {phase === 2 && (
          <g transform="translate(210 535)">
            {Array.from({ length: 20 }, (_, index) => (
              <rect key={index} x={index * 19} y={-(12 + ((index * 13) % 50))} width="12" height={12 + ((index * 13) % 50)} className={styles.rainBar} style={{ animationDelay: `${index * 0.05}s` }} />
            ))}
          </g>
        )}
        {phase === 4 && (
          <g>
            <circle cx="560" cy="130" r="30" className={styles.sun} />
            <rect x="665" y="185" width="12" height="78" rx="6" className={styles.thermo} />
            <rect x="668" y="190" width="6" height="68" className={styles.thermoFill} />
          </g>
        )}
        {phase >= 5 && (
          <g transform="translate(180 520)">
            {Array.from({ length: 6 }, (_, index) => (
              <rect key={index} x={index * 75} width="60" height="75" rx="6" className={styles.card} style={{ animationDelay: `${index * 0.07}s` }} />
            ))}
          </g>
        )}
      </svg>
      <button type="button" className={styles.satellite} aria-label={m.satellite} onClick={onSpin}>
        <span key={spins} className={spins > 0 ? styles.spin : undefined}>
          <SatelliteIcon size={72} />
        </span>
      </button>
      {lastResult && (
        <p key={phase} className={styles.achievement} aria-hidden="true">
          <CheckIcon />
          <strong>{lastResult.text}</strong>
        </p>
      )}
      <p className={styles.tip} aria-hidden="true">
        {m.touch}
      </p>
    </div>
  )
}
