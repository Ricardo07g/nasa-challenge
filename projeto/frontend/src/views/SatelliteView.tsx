import { Button, TextButton } from '../design-system/components/Button'
import { DataSourceCard } from '../design-system/components/Card'
import { RadioCard } from '../design-system/components/Choice'
import { PageHeading } from '../design-system/components/Content'
import { BackLink } from '../design-system/components/Navigation'
import { StripLegend, YearStrip, type CellState } from '../design-system/components/Status'
import { ClimateIcon, DropIcon, HistoryIcon, SoilIcon } from '../design-system/icons'
import { formatMonth } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import { TEXTURAS, type SituacaoAno, type Textura } from '../models/talhao'
import type { HistorySummary, RainSummary, SoilSummary } from '../services/satelliteService'
import { FlowError, FlowLoading, FlowOutside } from './FlowStates'
import type { ScreenStatus } from '../models/screenStatus'
import layout from './layout.module.css'

export type SatelliteViewProps = {
  t: Messages
  lang: Lang
  backTo: string
  status: ScreenStatus
  onRetry: () => void
  history: HistorySummary | null
  /** Anos de chuva usados de fato; null sem dado de chuva. */
  rain: RainSummary | null
  /** O NEX-GDDP-CMIP6 veio no talhão (só assim o clima dos próximos anos fica pronto). */
  climate: boolean
  soil: SoilSummary
  soilOpen: boolean
  onToggleSoil: () => void
  onChooseSoil: (value: Textura) => void
  onConfirm: () => void
}

/** Cheio = plantou; contorno laranja = ficou parado; cinza com "?" = o satélite não teve certeza. */
const CELL: Record<SituacaoAno, CellState> = { plantou: 'good', parado: 'bad', incerto: 'unknown', sem_dado: 'unknown' }

/** Tela 4 "Pronto. O satélite já viu o resto.": histórico e chuva à esquerda; terra, clima e botão à direita. */
export function SatelliteView(props: SatelliteViewProps) {
  const { t, backTo, status } = props
  const s = t.satellite
  return (
    <div className={layout.page}>
      <BackLink to={backTo}>{t.nav.back}</BackLink>
      <PageHeading title={s.title} subtitle={status === 'ready' || status === 'loading' ? s.subtitle : undefined} />
      {status === 'loading' && <FlowLoading label={s.loading} />}
      {status === 'error' && <FlowError t={t} message={s.error} onRetry={props.onRetry} />}
      {status === 'outside' && <FlowOutside t={t} />}
      {status === 'ready' && <Cards {...props} />}
    </div>
  )
}

function Cards({ t, lang, history, rain, climate, soil, soilOpen, onToggleSoil, onChooseSoil, onConfirm }: SatelliteViewProps) {
  const s = t.satellite
  const soilSource = { map: s.soilFromMap, user: s.soilFromUser, default: s.soilDefault }[soil.source]
  return (
    <div className={layout.pageGrid}>
      <div className={layout.stack}>
        {history && (
          <DataSourceCard
            icon={<HistoryIcon />}
            title={s.historyTitle(history.idle, history.known, history.uncertain)}
            subtitle={s.historySubtitle}
            readyLabel={t.common.ready}
          >
            <YearStrip
              size="lg"
              label={s.historyStripLabel(history.planted, history.known, history.uncertain)}
              cells={history.situations.map((situation) => CELL[situation])}
              years={history.years}
            />
            <StripLegend
              items={[
                { state: 'good', label: s.planted },
                { state: 'bad', label: s.idle },
                ...(history.uncertain > 0 ? [{ state: 'unknown' as const, label: s.uncertain }] : []),
              ]}
            />
            <p className={layout.muted}>
              {s.historySource(formatMonth(lang, history.window.from), formatMonth(lang, history.window.to))}
            </p>
          </DataSourceCard>
        )}
        <DataSourceCard
          icon={<DropIcon />}
          iconTone="blue"
          title={rain ? s.rainTitle(rain.years) : s.rainUnavailableTitle}
          subtitle={
            !rain ? s.notAvailable : rain.period ? s.rainSubtitle(rain.period.start, rain.period.end, rain.skipped) : s.rainDaily
          }
          readyLabel={t.common.ready}
          status={rain ? 'ready' : 'unavailable'}
          unavailableLabel={t.common.unavailable}
        />
      </div>
      <div className={layout.stack}>
        <DataSourceCard
          icon={<SoilIcon />}
          title={s.soilTitle(t.soil[soil.textura])}
          subtitle={soilSource}
          readyLabel={t.common.ready}
        >
          <TextButton expanded={soilOpen} onClick={onToggleSoil}>
            {soilOpen ? s.close : s.soilChange}
          </TextButton>
          {soilOpen && (
            <div role="group" aria-label={s.soilChoose} className={layout.stack}>
              {TEXTURAS.map((textura) => (
                <RadioCard
                  key={textura}
                  title={s.soilOptions[textura].title}
                  sub={s.soilOptions[textura].sub}
                  selected={soil.textura === textura}
                  onSelect={() => onChooseSoil(textura)}
                />
              ))}
            </div>
          )}
        </DataSourceCard>
        <DataSourceCard
          icon={<ClimateIcon />}
          iconTone="blue"
          title={s.climateTitle}
          subtitle={climate ? s.climateSubtitle : s.notAvailable}
          readyLabel={t.common.ready}
          status={climate ? 'ready' : 'unavailable'}
          unavailableLabel={t.common.unavailable}
        />
        <Button onClick={onConfirm} arrow>
          {s.cta}
        </Button>
      </div>
    </div>
  )
}
