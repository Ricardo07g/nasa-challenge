import { Button } from '../design-system/components/Button'
import { Card, SourceCard } from '../design-system/components/Card'
import { NumberedSteps, PageHeading, ScoreTable } from '../design-system/components/Content'
import { ErrorState, LoadingState } from '../design-system/components/Feedback'
import { BackLink } from '../design-system/components/Navigation'
import { ArrowUpRightIcon, GrainIcon, SatelliteIcon, SendIcon, SproutIcon } from '../design-system/icons'
import { formatDayMonth, formatNumber } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { MetodoRegras } from '../models/metodo'
import type { Opcao } from '../models/recomendacao'
import type { RainSummary } from '../services/satelliteService'
import type { SourceStatus } from '../services/sourceService'
import { rainPeriodText } from './rainPeriod'
import layout from './layout.module.css'

export type MethodViewProps = {
  t: Messages
  lang: Lang
  backTo: string
  /** Estado só da tabela de notas: o resto da tela é texto fixo e aparece na hora. */
  status: 'loading' | 'ready' | 'error'
  onRetry: () => void
  rows: { id: string; nome: string; notas: Opcao['notas'] }[]
  example: boolean
  /** P5: link do bot do Telegram; null quando não está configurado. */
  telegramHref: string | null
  /** Fontes conectadas de fato (pelo talhão) e o tamanho do quadrado da chuva usada. */
  sources: { status: 'loading' | 'ready' | 'error'; rows: SourceStatus[]; rainKm: number | null }
  onRetrySources: () => void
  /** Anos e período da chuva (do talhão), para o passo 1; null enquanto o talhão não chega. */
  rain: RainSummary | null
  /** Tarefa 0049: os números das regras (`GET /api/metodo`); null sem a rota ou com falha (o bloco some). */
  rules: MetodoRegras | null
}

/** "05-01" → "1º de maio" / "May 1". */
function monthDay(lang: Lang, md: string): string {
  return formatDayMonth(lang, `2023-${md}`)
}

/** As regras novas da conta (tarefa 0049), cada uma numa frase, com os números do regras.yaml. */
function Rules({ t, lang, rules }: { t: Messages; lang: Lang; rules: MetodoRegras }) {
  const r = t.method.rules
  const n = (value: number) => formatNumber(lang, value)
  const { deu_certo: d, pesos, agua, rotacao, plano_b: b, alertas, avisos, sinal } = rules
  const names = t.crops.names as Record<string, string>
  const crops = rotacao.culturas_supressoras_nematoide.map((id) => (names[id] ?? id).toLocaleLowerCase(lang))
  const items = [
    r.worked(n(d.isna_grao_pct), n(d.janela_grao_meia_dias), n(d.isna_cobertura_pct), n(d.janela_cobertura_dias), n(d.calor_temp_c), n(d.calor_min_dias)),
    r.weights(n(pesos.seguranca_pct), n(pesos.futuro_pct), n(pesos.solo_pct), n(pesos.renda_pct)),
    r.income(n(rules.renda.nota_sem_grao)),
    r.water(n(agua.percentil_seco)),
    r.thirst(n(agua.sede_pouca_ate_mm), n(agua.sede_muita_desde_mm)),
    r.rotation(n(rotacao.bonus_diversidade_2), n(rotacao.bonus_diversidade_3), crops.join(` ${r.and} `)),
    r.planB(n(b.dias_antes_semeadura), n(b.anos_falha_min), n(b.sensibilidade_min_pct), n(b.precisao_min_pct), n(b.chance_max_pct)),
    r.frost(n(alertas.geada_temp_c), monthDay(lang, alertas.geada_inicio), monthDay(lang, alertas.geada_fim)),
    r.heavyRain(n(alertas.chuva_forte_mm), monthDay(lang, alertas.chuva_forte_inicio), monthDay(lang, alertas.chuva_forte_fim)),
    r.fire(n(alertas.fogo_raio_km)),
    r.alerts(
      n(avisos.terra_seca_percentil_max),
      n(avisos.dias_sem_chuva_min),
      n(avisos.calor_dias_min),
      n(d.calor_temp_c),
      n(avisos.calor_janela_dias),
      n(avisos.vizinhos_dias),
      n(avisos.raio_km),
    ),
    r.signal(n(sinal.fase_chance_min_pct), n(sinal.anos_fase_min), n(sinal.anos_ruins_seco_pct)),
    r.xray,
  ]
  return (
    <Card as="section" aria-label={r.title}>
      <h2 className={layout.cardTitle}>{r.title}</h2>
      <p className={layout.muted}>{r.intro}</p>
      <ul className={layout.stack}>
        {items.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </Card>
  )
}

/** Tela 9 "Como a conta é feita" (para agrônomos e jurados): método, fontes e notas de 0 a 100. */
export function MethodView(props: MethodViewProps) {
  const { t, lang, backTo, status, onRetry, rows, example, telegramHref, sources, rain, rules } = props
  const m = t.method
  const h = m.scoresHeaders
  const years = rain ? rainPeriodText(t, rain.years, rain) : null
  return (
    <div className={layout.page}>
      <BackLink to={backTo}>{t.nav.back}</BackLink>
      <PageHeading title={m.title} subtitle={m.subtitle} />
      <div className={layout.pageGrid}>
        <NumberedSteps size="lg" steps={[years ? m.step1(years) : m.step1Generic, m.step2, m.step3]} />
        <div className={layout.stack}>
          <Card tone="green" as="section" aria-label={m.noAiTitle}>
            <h2 className={layout.iconTitle}>
              <SproutIcon />
              {m.noAiTitle}
            </h2>
            <p>{m.noAiText}</p>
          </Card>
        </div>
      </div>
      {/* Tarefa 0040: a renda sem preço nem custo (dá grão ou não, combinado com a segurança). */}
      <Card as="section" aria-label={m.incomeTitle}>
        <h2 className={layout.iconTitle}>
          <GrainIcon />
          {m.incomeTitle}
        </h2>
        <p>{rules ? m.incomeTextScore(formatNumber(lang, rules.renda.nota_sem_grao)) : m.incomeText}</p>
        <p className={layout.muted}>{m.incomeShown}</p>
      </Card>
      {rules && <Rules t={t} lang={lang} rules={rules} />}
      <Card tone="blue" as="section" aria-label={m.blindTitle}>
        <h2 className={layout.iconTitle} data-tone="blue">
          <SatelliteIcon />
          {m.blindTitle}
        </h2>
        <p>
          {sources.rainKm ? m.blindRain(sources.rainKm) : m.blindRainGeneric} {m.blindRest}
        </p>
      </Card>
      <section aria-label={m.sourcesTitle} className={layout.stack}>
        <h2 className={layout.sectionTitle}>{m.sourcesTitle}</h2>
        <p className={layout.muted}>{m.sourcesArea}</p>
        {sources.status === 'loading' && <LoadingState>{t.common.loading}</LoadingState>}
        {sources.status === 'error' && (
          <ErrorState message={t.common.loadError} retryLabel={t.common.retry} onRetry={props.onRetrySources} />
        )}
        {sources.status === 'ready' && (
          <div className={layout.optionGrid}>
            {/* Só as fontes ligadas de fato; a que a API não manda não aparece (decisão D2). */}
            {sources.rows
              .filter(({ connected }) => connected)
              .map(({ key }) => (
                <SourceCard key={key} what={m.sources[key].what} source={m.sources[key].source} scale={m.sources[key].scale} />
              ))}
          </div>
        )}
      </section>
      {telegramHref && (
        <Card tone="blue" as="section" aria-label={t.telegram.methodTitle}>
          <h2 className={layout.iconTitle} data-tone="blue">
            <SendIcon />
            {t.telegram.methodTitle}
          </h2>
          <p>{t.telegram.method}</p>
          <div>
            <Button href={telegramHref} variant="blue" fullWidth={false} iconEnd={<ArrowUpRightIcon size={18} />}>
              {t.telegram.open}
            </Button>
          </div>
        </Card>
      )}
      <Card>
        {status === 'loading' && <LoadingState>{t.common.loading}</LoadingState>}
        {status === 'error' && <ErrorState message={t.common.loadError} retryLabel={t.common.retry} onRetry={onRetry} />}
        {status === 'ready' && (
          <>
            <ScoreTable
              caption={m.scoresTitle}
              headers={[h.crop, h.safety, h.future, h.soil, h.income, h.final]}
              rows={rows.map(({ nome, notas }) => ({
                name: nome,
                values: [notas.seguranca, notas.futuro, notas.solo, notas.renda, notas.final],
              }))}
            />
            {example && <p className={layout.muted}>{m.exampleFarm}</p>}
          </>
        )}
      </Card>
      <p className={layout.muted}>{m.disclaimer}</p>
    </div>
  )
}
