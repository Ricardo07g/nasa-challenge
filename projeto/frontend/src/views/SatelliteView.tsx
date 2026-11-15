import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button, TextButton } from '../design-system/components/Button'
import { Card, DataSourceCard } from '../design-system/components/Card'
import { ChipGroup, RadioCard } from '../design-system/components/Choice'
import { PageHeading } from '../design-system/components/Content'
import {
  CountUp,
  InstrumentBlock,
  InstrumentPanel,
  Meter,
  NdviHeatmap,
  SplitBar,
  type HeatLevel,
} from '../design-system/components/Instrument'
import { MiniMap } from '../design-system/components/MiniMap'
import { BackLink } from '../design-system/components/Navigation'
import { StripLegend, YearStrip, type CellState } from '../design-system/components/Status'
import {
  ClimateIcon,
  DropIcon,
  FireIcon,
  FrostIcon,
  HeavyRainIcon,
  HistoryIcon,
  SoilIcon,
  WarningIcon,
} from '../design-system/icons'
import {
  formatCoordinates,
  formatDayMonth,
  formatDecimal,
  formatFullDate,
  formatMonth,
  formatNumber,
} from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { RaioX } from '../models/raioX'
import { TEXTURAS, type Confirmacao, type SituacaoAno, type Textura } from '../models/talhao'
import type { ConfirmRow } from '../services/confirmedSeasonsService'
import {
  regionSide,
  soilParts,
  type AreaAlert,
  type Heatmap,
  type XRayBlock,
} from '../services/raioXService'
import type { ClimateSummary, HistorySummary, RainSummary, SoilSummary } from '../services/satelliteService'
import { FlowError, FlowLoading, FlowOutside } from './FlowStates'
import { futureClimateText } from './futureClimateText'
import { ShareSeasons, type ShareSeasonsProps } from './ShareSeasons'
import type { ScreenStatus } from '../models/screenStatus'
import layout from './layout.module.css'
import styles from './SatelliteView.module.css'

/** O painel do raio-X montado pelo controller: o dado do backend, os blocos, o lugar e o ponto. */
export type XRayModel = { raio: RaioX; blocks: XRayBlock[]; place: string; point: { lat: number; lon: number } }

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
  /** Anos de chuva usados de fato; null sem dado de chuva (só sem o raio-X). */
  rain: RainSummary | null
  /** NEX-GDDP-CMIP6 no talhão; null sem ele (só sem o raio-X). */
  climate: ClimateSummary | null
  soil: SoilSummary
  soilOpen: boolean
  onToggleSoil: () => void
  onChooseSoil: (value: Textura) => void
  onConfirm: () => void
  /** Raio-X da sua terra (tarefa 0043); null sem o dado (o painel não aparece). */
  xray: XRayModel | null
  /** Histórico do talhão em faixa de calor do NDVI; null sem a faixa (fica a faixa de quadrinhos). */
  heatmap: Heatmap | null
  /** Alertas da área que o dado indica (cada um só vem com risco). */
  alerts: AreaAlert[]
  /** Cartões menores (20 anos de chuva, clima 2041–2060); null sem o raio-X. */
  cards: RaioX['cartoes'] | null
  /** "ver na sugestão": a resposta com o caminho todo. */
  answerTo: string
}

/** Artigos do Guia ligados a esta tela (tabela da seção 8 da remodelagem); só os que existem. */
const ARTICLE = {
  xray: '/guia/raio-x',
  dryspell: '/guia/veranico',
  heat: '/guia/calor-35-graus',
  frost: '/guia/geada-na-safrinha',
  fire: '/guia/fogo-na-palha',
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

/** Um ano comum só para escrever o "MM-DD" como "19 de abril". */
const dayMonth = (lang: Lang, mmdd: string) => formatDayMonth(lang, `2023-${mmdd}`)

/** Nome da cultura no meio da frase ("milho com braquiária"). */
function cropName(t: Messages, id: string): string {
  const names: Record<string, string> = t.crops.names
  const name = names[id] ?? id
  return name.charAt(0).toLowerCase() + name.slice(1)
}

function yearList(lang: Lang, years: readonly number[]): string {
  if (years.length <= 1) return years.join('')
  return `${years.slice(0, -1).join(', ')} ${lang === 'pt' ? 'e' : 'and'} ${years.at(-1)}`
}

/** Tela 4 "O que o satélite viu": o raio-X do ponto, o histórico, os alertas e os cartões menores. */
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

function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={styles.panelLink}>
      {children}
    </Link>
  )
}

/** Painel "Raio-X da sua terra": cabeçalho com o lugar e o mapa, os blocos e o rodapé. */
function XRayPanel(props: SatelliteViewProps & { xray: XRayModel }) {
  const { t, lang, xray } = props
  const x = t.xray
  const { raio, place, point } = xray
  const header = (
    <div className={styles.xrayHeader}>
      <MiniMap label={x.mapLabel(place)} point={point} />
      <div className={styles.xrayHeaderText}>
        <p className={styles.xrayPlace}>{x.place(place)}</p>
        <p>{x.coordinates(formatCoordinates(point))}</p>
        {raio.leitura_recente && <p>{x.latestReading(formatFullDate(lang, raio.leitura_recente))}</p>}
        {raio.altitude_m !== null && <p>{x.altitude(formatNumber(lang, raio.altitude_m))}</p>}
      </div>
    </div>
  )
  return (
    <InstrumentPanel title={x.panelTitle} header={header} footer={x.footer}>
      {xray.blocks.map((block, index) => (
        <XRayBlockView key={block.kind} {...props} block={block} index={index} />
      ))}
    </InstrumentPanel>
  )
}

function XRayBlockView(props: SatelliteViewProps & { block: XRayBlock; index: number }) {
  const { t, lang, block, index, soil, soilOpen, onToggleSoil } = props
  const x = t.xray
  const integer = (value: number) => formatNumber(lang, value)
  const learnMore = (to: string, title: string) => <PanelLink to={to}>{x.learnMore(title)}</PanelLink>
  switch (block.kind) {
    case 'soil': {
      const parts = soilParts(block.data)
      return (
        <InstrumentBlock
          index={index}
          label={x.soil.label}
          value={<CountUp value={parts.clay} format={integer} />}
          unit={x.soil.unit}
          badge={x.badges.soil}
          actions={
            <>
              <button type="button" className={styles.panelButton} aria-expanded={soilOpen} onClick={onToggleSoil}>
                {soilOpen ? t.satellite.close : t.satellite.soilChange}
              </button>
              {learnMore(ARTICLE.xray, x.articles.xray)}
            </>
          }
          sentence={
            <>
              {x.soil.sentence(t.soil[block.data.textura])}
              {block.data.vizinho_km !== null && ` ${x.soil.neighbor(formatDecimal(lang, block.data.vizinho_km, 1))}`}
              {soil.source === 'user' && ` ${x.soil.chosen(t.soil[soil.textura])}`}
            </>
          }
        >
          <SplitBar
            label={x.soil.barLabel(parts.clay, parts.silt, parts.sand)}
            parts={[
              { key: 'clay', label: x.soil.parts.clay, pct: parts.clay },
              { key: 'silt', label: x.soil.parts.silt, pct: parts.silt },
              { key: 'sand', label: x.soil.parts.sand, pct: parts.sand },
            ]}
          />
        </InstrumentBlock>
      )
    }
    case 'water': {
      const water = block.data
      const days =
        water.dias !== null && water.cultura && water.floracao
          ? x.water.days(water.dias, cropName(t, water.cultura), dayMonth(lang, water.floracao))
          : x.water.noCrop
      const use =
        water.dias !== null && water.consumo_mm_dia !== null && water.eto_mm_dia !== null && water.kc !== null
          ? ` ${x.water.use(formatDecimal(lang, water.consumo_mm_dia, 1), formatDecimal(lang, water.eto_mm_dia, 1), formatDecimal(lang, water.kc, 2))}`
          : ''
      return (
        <InstrumentBlock
          index={index}
          label={x.water.label}
          value={<CountUp value={water.cad_mm} format={integer} />}
          unit={x.water.unit}
          badge={x.badges.water}
          sentence={`${days}${use}`}
          actions={learnMore(ARTICLE.xray, x.articles.xray)}
        />
      )
    }
    case 'moisture': {
      const pct = Math.round(block.data.percentil)
      return (
        <InstrumentBlock
          index={index}
          label={x.moisture.label}
          value={<CountUp value={pct} format={integer} />}
          unit="%"
          badge={x.badges.moisture}
          sentence={x.moisture.sentence(pct, formatFullDate(lang, block.data.data))}
        >
          <Meter label={x.moisture.meterLabel(pct)} value={pct} lowLabel={x.moisture.low} highLabel={x.moisture.high} />
        </InstrumentBlock>
      )
    }
    case 'green': {
      const green = block.data
      const main = green.ultimo_ndvi ?? green.pico_ndvi ?? 0
      const ndvi = (value: number) => formatDecimal(lang, value, 2)
      const lines = [
        green.ultimo_ndvi !== null && green.ultimo_data && x.green.last(ndvi(green.ultimo_ndvi), formatFullDate(lang, green.ultimo_data)),
        green.pico_ndvi !== null &&
          green.safra &&
          (green.pico_data
            ? x.green.peakOn(ndvi(green.pico_ndvi), green.safra, formatFullDate(lang, green.pico_data))
            : x.green.peak(ndvi(green.pico_ndvi), green.safra)),
        x.green.scale,
      ].filter(Boolean)
      return (
        <InstrumentBlock
          index={index}
          label={x.green.label}
          value={<CountUp value={main} format={ndvi} />}
          unit={x.green.unit}
          badge={x.badges.green}
          sentence={lines.join(' ')}
        />
      )
    }
    case 'rain': {
      const rain = block.data
      const end = rain.fim_das_chuvas
      const endText = end
        ? ` ${x.rain.end(dayMonth(lang, end.mediana), dayMonth(lang, end.mais_cedo.dia), end.mais_cedo.ano, dayMonth(lang, end.mais_tarde.dia), end.mais_tarde.ano)}`
        : ''
      return (
        <InstrumentBlock
          index={index}
          label={x.rain.label}
          value={<CountUp value={rain.media_mm} format={integer} />}
          unit={x.rain.unit}
          badge={x.badges.rain}
          sentence={`${x.rain.years(rain.anos.length)}${endText}`}
        />
      )
    }
    case 'dryspell':
      return (
        <InstrumentBlock
          index={index}
          label={x.dryspell.label}
          value={<CountUp value={block.data.dias} format={integer} />}
          unit={x.dryspell.unit}
          badge={x.badges.dryspell}
          sentence={x.dryspell.sentence(block.data.ano, dayMonth(lang, block.data.inicio))}
          actions={learnMore(ARTICLE.dryspell, x.articles.dryspell)}
        />
      )
    case 'heat': {
      const heat = block.data
      const years = heat.anos.length > 0 ? ` ${x.heat.years(yearList(lang, heat.anos))}` : ''
      return (
        <InstrumentBlock
          index={index}
          label={x.heat.label}
          value={<CountUp value={heat.anos_com_calor} format={integer} />}
          unit={x.heat.unit(heat.total_anos)}
          badge={x.badges.heat}
          sentence={`${x.heat.sentence(formatNumber(lang, heat.temp_c))}${years}`}
          actions={learnMore(ARTICLE.heat, x.articles.heat)}
        />
      )
    }
    case 'region': {
      const side = regionSide(block.data)
      return (
        <InstrumentBlock
          index={index}
          label={x.region.label}
          value={<CountUp value={side.pct} format={integer} />}
          unit="%"
          badge={x.badges.region}
          sentence={`${side.side === 'drier' ? x.region.drier(side.pct) : x.region.wetter(side.pct)} ${x.region.detail(integer(block.data.chuva_mm), block.data.celulas)}`}
        />
      )
    }
  }
}

/** As 3 terras para o produtor escolher ("Não é? Trocar"). */
function SoilChooser({ t, soil, onChooseSoil }: SatelliteViewProps) {
  const s = t.satellite
  return (
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
  )
}

/** "Não parece uma lavoura de soja": um aviso, sem selo de "pronto". */
function SoyWarning({ t, title, children }: { t: Messages; title: boolean; children?: ReactNode }) {
  const s = t.satellite
  return (
    <div className={styles.soyWarning}>
      <span className={styles.warningIcon}>
        <WarningIcon size={22} />
      </span>
      <div className={layout.stack}>
        {title ? <h2 className={styles.warningTitle}>{s.noSoyTitle}</h2> : <p className={styles.warningTitle}>{s.noSoyTitle}</p>}
        {title && <p>{s.noSoyDetail}</p>}
        {children}
      </div>
    </div>
  )
}

/** A faixa de calor do NDVI, com o que aconteceu em cada ano escrito no fim da linha. */
function HeatmapFigure({ t, lang, heatmap, history }: { t: Messages; lang: Lang; heatmap: Heatmap; history: HistorySummary | null }) {
  const x = t.xray.history
  const columns = heatmap.columns
  const ndvi = (value: number) => formatDecimal(lang, value, 2)
  const marks = [
    { label: x.marks.soy, from: heatmap.marks.soy[0], to: heatmap.marks.soy[1] },
    ...(heatmap.marks.harvest !== null
      ? [{ label: x.marks.harvest, from: heatmap.marks.harvest, to: heatmap.marks.harvest + 1 }]
      : []),
    { label: x.marks.offseason, from: heatmap.marks.offseason[0], to: heatmap.marks.offseason[1] },
  ].filter((mark) => mark.to > mark.from)
  const months = heatmap.months.map((month, index) => ({
    label: formatMonth(lang, month.month).slice(0, 3),
    from: month.from,
    span: (heatmap.months[index + 1]?.from ?? columns.length) - month.from,
  }))
  const years = heatmap.rows.map((row) => row.year)
  const rows = heatmap.rows.map((row) => {
    const tag = row.situation ? x.tags[row.situation] : ''
    return {
      year: row.year,
      tag: row.byProducer && tag ? x.byProducer(tag) : tag,
      cells: row.cells.map((cell, index) => ({
        level: cell.level as HeatLevel,
        title:
          cell.value === null
            ? x.cellEmpty(dayMonth(lang, columns[index]))
            : x.cell(dayMonth(lang, columns[index]), ndvi(cell.value)),
      })),
    }
  })
  return (
    <>
      <p className={layout.muted}>{x.subtitle}</p>
      <NdviHeatmap
        label={x.label(Math.min(...years), Math.max(...years), history?.idle ?? 0, history?.total ?? years.length)}
        months={months}
        marks={marks}
        rows={rows}
        legend={x.legend.map((label, index) => ({ level: (index + 1) as HeatLevel, label }))}
        noDataLabel={x.noData}
      />
      <p className={layout.muted}>{x.source}</p>
    </>
  )
}

/** Histórico do talhão (faixa de calor do NDVI, ou os quadrinhos sem ela) e a confirmação das safras. */
function HistoryCard(props: SatelliteViewProps) {
  const { t, lang, history, heatmap, confirmations, onConfirmSeason, share, noSoy, adjustTo } = props
  const s = t.satellite
  const x = t.xray.history
  const confirm = confirmations.length > 0 && (
    <ConfirmSeasons t={t} rows={confirmations} onConfirm={onConfirmSeason} share={share ?? null} />
  )
  if (!history && noSoy) {
    return (
      <Card as="section">
        <SoyWarning t={t} title>
          <div className={layout.cta}>
            <Button to={adjustTo} variant="outline">
              {s.adjustMap}
            </Button>
          </div>
        </SoyWarning>
        {heatmap && <HeatmapFigure t={t} lang={lang} heatmap={heatmap} history={history} />}
        {confirm}
      </Card>
    )
  }
  // Sem histórico do satélite, o cartão não aparece (decisão D2); com anos para confirmar, o produtor
  // responde direto (5.6 do pedido: "Sem NDVI para o ponto, pergunte direto").
  if (!history) return confirm ? <Card>{confirm}</Card> : null
  const others = x.others(history.uncertain, history.noSoy)
  return (
    <Card as="section">
      <div className={styles.historyHead}>
        <span className={styles.historyIcon}>
          <HistoryIcon />
        </span>
        <div>
          <h2 className={styles.historyTitle}>{x.title(history.idle, history.total)}</h2>
          {others && <p className={layout.muted}>{others}</p>}
        </div>
      </div>
      {noSoy && <SoyWarning t={t} title={false} />}
      {heatmap ? (
        <HeatmapFigure t={t} lang={lang} heatmap={heatmap} history={history} />
      ) : (
        <>
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
          />
          <p className={layout.muted}>
            {s.historySource(formatMonth(lang, history.window.from), formatMonth(lang, history.window.to))}
          </p>
        </>
      )}
      {history.confirmed > 0 && <p className={layout.muted}>{s.historyConfirmed(history.confirmed)}</p>}
      {confirm}
    </Card>
  )
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

const ALERT_ICON = { frost: <FrostIcon />, heavyRain: <HeavyRainIcon />, fire: <FireIcon /> }

/** Alertas da sua área: cada um só aparece se o dado indicar risco (o backend só manda esses). */
function AreaAlerts({ t, lang, alerts }: SatelliteViewProps) {
  const titleId = useId()
  if (alerts.length === 0) return null
  const a = t.xray.alerts
  const items = alerts.map((alert) => {
    switch (alert.kind) {
      case 'frost':
        return {
          kind: alert.kind,
          title: a.frost.title,
          text: a.frost.text(alert.data.anos.length, alert.data.total_anos, formatNumber(lang, alert.data.temp_c)),
          link: { to: ARTICLE.frost, title: t.xray.articles.frost },
        }
      case 'heavyRain':
        return {
          kind: alert.kind,
          title: a.heavyRain.title,
          text: a.heavyRain.text(
            formatDecimal(lang, alert.data.media_dias_ano, 1),
            formatNumber(lang, alert.data.limite_mm),
            alert.data.dias,
            alert.data.total_anos,
          ),
          link: null,
        }
      case 'fire':
        return {
          kind: alert.kind,
          title: a.fire.title,
          text: a.fire.text(formatNumber(lang, alert.data.raio_km), alert.data.anos.length, alert.data.total_anos),
          link: { to: ARTICLE.fire, title: t.xray.articles.fire },
        }
    }
  })
  return (
    <section aria-labelledby={titleId} className={layout.stack}>
      <h2 id={titleId} className={styles.sectionTitle}>
        {a.title}
      </h2>
      <ul className={styles.alerts}>
        {items.map((item) => (
          <li key={item.kind} className={styles.alert}>
            <span className={styles.alertIcon}>{ALERT_ICON[item.kind]}</span>
            <div className={styles.alertText}>
              <h3 className={styles.alertTitle}>{item.title}</h3>
              <p>{item.text}</p>
              {item.link && (
                <Link to={item.link.to} className={layout.iconLink}>
                  {t.xray.learnMore(item.link.title)}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Cartões menores: em quantos anos a melhor opção deu certo e o clima de 2041 a 2060. */
function SmallCards({ t, lang, cards, answerTo }: SatelliteViewProps & { cards: RaioX['cartoes'] }) {
  const c = t.xray.cards
  const rain = cards.chuva_20_anos
  const future = cards.clima_futuro
  const futureText = future && futureClimateText(t, lang, future)
  const see = (
    <Link to={answerTo} className={layout.iconLink}>
      {c.seeAnswer}
    </Link>
  )
  return (
    <>
      {rain && (
        <Card as="section">
          <h2 className={styles.smallTitle}>{c.rainTitle(rain.total_anos)}</h2>
          <p className={styles.bigNumber}>{c.rainValue(rain.anos_bons, rain.total_anos)}</p>
          <p>{c.rainText(cropName(t, rain.cultura))}</p>
          {see}
        </Card>
      )}
      {futureText && (
        <Card as="section">
          <h2 className={styles.smallTitle}>{c.futureTitle}</h2>
          <p className={styles.mediumNumber}>{futureText.rain}</p>
          <p className={styles.mediumNumber}>{futureText.heat}</p>
          <p>{futureText.agreement}</p>
          <p className={layout.muted}>{c.futureSource}</p>
          {see}
        </Card>
      )}
    </>
  )
}

/** Sem o raio-X: os cartões de antes (chuva e clima), só com o dado que chegou. */
function LegacyCards({ t, rain, climate }: SatelliteViewProps) {
  const s = t.satellite
  return (
    <>
      {rain && (
        <DataSourceCard
          icon={<DropIcon />}
          iconTone="blue"
          title={s.rainTitle(rain.years)}
          subtitle={rain.period ? s.rainSubtitle(rain.period.start, rain.period.end, rain.skipped) : s.rainDaily}
          readyLabel={t.common.ready}
        />
      )}
      {climate && (
        <DataSourceCard
          icon={<ClimateIcon />}
          iconTone="blue"
          title={s.climateTitle}
          subtitle={climate.period ? s.climateSubtitle(climate.period.start, climate.period.end) : s.climateSubtitleGeneric}
          readyLabel={t.common.ready}
        />
      )}
    </>
  )
}

/** Sem o bloco de solo no painel: o cartão da terra de antes, com "Não é? Trocar". */
function LegacySoilCard(props: SatelliteViewProps) {
  const { t, soil, soilOpen, onToggleSoil } = props
  const s = t.satellite
  const soilSource = { map: s.soilFromMap, user: s.soilFromUser, default: s.soilDefault }[soil.source]
  return (
    <DataSourceCard icon={<SoilIcon />} title={s.soilTitle(t.soil[soil.textura])} subtitle={soilSource} readyLabel={t.common.ready}>
      <TextButton expanded={soilOpen} onClick={onToggleSoil}>
        {soilOpen ? s.close : s.soilChange}
      </TextButton>
      {soilOpen && <SoilChooser {...props} />}
    </DataSourceCard>
  )
}

function Cards(props: SatelliteViewProps) {
  const { t, xray, cards, soilOpen, onConfirm } = props
  const soilInPanel = xray?.blocks.some((block) => block.kind === 'soil') ?? false
  return (
    <div className={layout.stack}>
      {xray && <XRayPanel {...props} xray={xray} />}
      {soilInPanel && soilOpen && (
        <Card>
          <SoilChooser {...props} />
        </Card>
      )}
      <HistoryCard {...props} />
      <AreaAlerts {...props} />
      <div className={styles.cardsRow}>
        {cards ? <SmallCards {...props} cards={cards} /> : <LegacyCards {...props} />}
        {!soilInPanel && <LegacySoilCard {...props} />}
      </div>
      <div className={styles.cta}>
        <Button onClick={onConfirm} arrow>
          {t.satellite.cta}
        </Button>
      </div>
    </div>
  )
}
