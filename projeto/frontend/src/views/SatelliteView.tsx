import { useId } from 'react'
import { Button, TextButton } from '../design-system/components/Button'
import { Card, DataSourceCard } from '../design-system/components/Card'
import { ChipGroup, RadioCard } from '../design-system/components/Choice'
import { PageHeading } from '../design-system/components/Content'
import { BackLink } from '../design-system/components/Navigation'
import { StripLegend, YearStrip, type CellState } from '../design-system/components/Status'
import { ClimateIcon, DropIcon, HistoryIcon, SoilIcon } from '../design-system/icons'
import { formatMonth } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import { TEXTURAS, type Confirmacao, type SituacaoAno, type Textura } from '../models/talhao'
import type { ConfirmRow } from '../services/confirmedSeasonsService'
import type { ClimateSummary, HistorySummary, RainSummary, SoilSummary } from '../services/satelliteService'
import { FlowError, FlowLoading, FlowOutside } from './FlowStates'
import { ShareSeasons, type ShareSeasonsProps } from './ShareSeasons'
import type { ScreenStatus } from '../models/screenStatus'
import layout from './layout.module.css'
import styles from './SatelliteView.module.css'

export type SatelliteViewProps = {
  t: Messages
  lang: Lang
  backTo: string
  status: ScreenStatus
  onRetry: () => void
  history: HistorySummary | null
  /** As últimas safras para o produtor confirmar (tarefa 0039); vazio = sem o bloco. */
  confirmations: ConfirmRow[]
  /** "Plantei" / "Deixei parado"; `null` = tocou de novo na resposta marcada (volta para o satélite). */
  onConfirmSeason: (year: number, value: Confirmacao | null) => void
  /** "Compartilhar com a comunidade" das safras confirmadas (tarefa 0047); null = não oferece. */
  share?: Omit<ShareSeasonsProps, 't'> | null
  /** O satélite não viu soja no ponto em nenhum ano: "Não parece uma lavoura de soja". */
  noSoy: boolean
  /** "Ajustar no mapa": volta ao mapa com o ponto. */
  adjustTo: string
  /** Anos de chuva usados de fato; null sem dado de chuva. */
  rain: RainSummary | null
  /** NEX-GDDP-CMIP6 no talhão; null sem ele (o cartão do clima dos próximos anos não aparece, decisão D2). */
  climate: ClimateSummary | null
  soil: SoilSummary
  soilOpen: boolean
  onToggleSoil: () => void
  onChooseSoil: (value: Textura) => void
  onConfirm: () => void
}

/**
 * Cheio = plantou; contorno laranja = ficou parado; cinza com "?" = o satélite não teve certeza;
 * pontilhado com "–" = sem soja naquele ano.
 */
const CELL: Record<SituacaoAno, CellState> = {
  plantou: 'good',
  parado: 'bad',
  incerto: 'unknown',
  sem_dado: 'unknown',
  sem_soja: 'none',
}

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

/** Cartão 1: o histórico do satélite (com as safras confirmadas) e o bloco de confirmação. */
function HistoryCard({ t, lang, history, confirmations, onConfirmSeason, share, noSoy, adjustTo }: SatelliteViewProps) {
  const s = t.satellite
  const confirm = confirmations.length > 0 && (
    <ConfirmSeasons t={t} rows={confirmations} onConfirm={onConfirmSeason} share={share ?? null} />
  )
  if (history) {
    return (
      <DataSourceCard
        icon={<HistoryIcon />}
        title={s.historyTitle(history.idle, history.known, history.uncertain)}
        subtitle={s.historySubtitle}
        readyLabel={t.common.ready}
      >
        {noSoy && <p className={styles.noSoyNote}>{s.noSoyTitle}</p>}
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
            ...(history.noSoy > 0 ? [{ state: 'none' as const, label: s.noSoy }] : []),
          ]}
          note={history.confirmed > 0 ? s.historyConfirmed(history.confirmed) : undefined}
        />
        <p className={layout.muted}>
          {s.historySource(formatMonth(lang, history.window.from), formatMonth(lang, history.window.to))}
        </p>
        {confirm}
      </DataSourceCard>
    )
  }
  if (noSoy) {
    return (
      <DataSourceCard icon={<HistoryIcon />} title={s.noSoyTitle} subtitle={s.noSoyDetail} readyLabel={t.common.ready}>
        <div className={layout.cta}>
          <Button to={adjustTo} variant="outline">
            {s.adjustMap}
          </Button>
        </div>
        {confirm}
      </DataSourceCard>
    )
  }
  // Sem histórico do satélite, o cartão não aparece (decisão D2); com anos para confirmar, o produtor
  // responde direto (5.6 do pedido: "Sem NDVI para o ponto, pergunte direto").
  return confirm ? <Card>{confirm}</Card> : null
}

/** "Confirme as últimas safras": um grupo de botões por ano, com o que o satélite viu ao lado. */
function ConfirmSeasons({
  t,
  rows,
  onConfirm,
  share,
}: {
  t: Messages
  rows: ConfirmRow[]
  onConfirm: SatelliteViewProps['onConfirmSeason']
  share: Omit<ShareSeasonsProps, 't'> | null
}) {
  const s = t.satellite
  const titleId = useId()
  const options = [
    { value: 'plantou' as const, label: s.confirmPlanted },
    { value: 'parado' as const, label: s.confirmIdle },
  ]
  return (
    <section className={styles.confirm} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.confirmTitle}>
        {s.confirmTitle}
      </h3>
      <p className={layout.muted}>{s.confirmHint}</p>
      {rows.map((row) => (
        <div key={row.year} className={styles.confirmRow}>
          <span className={styles.confirmYear}>
            <strong>{row.year}</strong>
            {row.satellite && (
              <span className={layout.muted}>{s.satelliteSaw(s.satelliteSawLabels[row.satellite])}</span>
            )}
          </span>
          <ChipGroup
            label={s.confirmYear(row.year)}
            options={options}
            value={row.choice}
            onChange={(value) => onConfirm(row.year, value)}
            allowDeselect
          />
        </div>
      ))}
      {share && <ShareSeasons t={t} {...share} />}
    </section>
  )
}

function Cards(props: SatelliteViewProps) {
  const { t, rain, climate, soil, soilOpen, onToggleSoil, onChooseSoil, onConfirm } = props
  const s = t.satellite
  const soilSource = { map: s.soilFromMap, user: s.soilFromUser, default: s.soilDefault }[soil.source]
  return (
    <div className={layout.pageGrid}>
      <div className={layout.stack}>
        <HistoryCard {...props} />
        {rain && (
          <DataSourceCard
            icon={<DropIcon />}
            iconTone="blue"
            title={s.rainTitle(rain.years)}
            subtitle={rain.period ? s.rainSubtitle(rain.period.start, rain.period.end, rain.skipped) : s.rainDaily}
            readyLabel={t.common.ready}
          />
        )}
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
        {climate && (
          <DataSourceCard
            icon={<ClimateIcon />}
            iconTone="blue"
            title={s.climateTitle}
            subtitle={climate.period ? s.climateSubtitle(climate.period.start, climate.period.end) : s.climateSubtitleGeneric}
            readyLabel={t.common.ready}
          />
        )}
        <Button onClick={onConfirm} arrow>
          {s.cta}
        </Button>
      </div>
    </div>
  )
}
