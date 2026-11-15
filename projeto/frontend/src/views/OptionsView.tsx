import { OptionCompareCard, PageHeading } from '../design-system/components/Content'
import { StatusPill, ThirstBadge } from '../design-system/components/Status'
import { ClimateIcon, DropIcon, GrainIcon, SoilIcon } from '../design-system/icons'
import { PlantImage } from '../design-system/plants/PlantImage'
import type { AnswerNav } from '../controllers/useAnswerNav'
import type { Messages } from '../i18n/messages.pt'
import type { Opcao } from '../models/recomendacao'
import { futureSummary, type LateSummary } from '../services/recomendacaoRules'
import type { RainSummary } from '../services/satelliteService'
import { AnswerHeader } from './AnswerHeader'
import { FlowError, FlowLoading, FlowOutside, LateWarning } from './FlowStates'
import type { ScreenStatus } from '../models/screenStatus'
import { rainPeriodText } from './rainPeriod'
import { RainYears } from './RainYears'
import layout from './layout.module.css'

export type OptionsViewProps = {
  t: Messages
  nav: AnswerNav
  status: ScreenStatus
  onRetry: () => void
  summary: { options: Opcao[]; late: LateSummary } | null
  /** Anos e período da chuva (do talhão), para a legenda dos quadrinhos. */
  rain: RainSummary | null
}

/** Clima de 2041–2060 da opção, no mesmo formato da resposta; sem o CMIP6, a linha não aparece (D2). */
function futureRows(t: Messages, option: Opcao) {
  const future = futureSummary(option)
  if (!future) return []
  return [
    {
      label: t.answer.future,
      icon: <ClimateIcon />,
      iconTone: 'blue' as const,
      value: t.answer.futureYears(future.good, future.total, future.range),
    },
  ]
}

/** Linha "Água" (tarefa 0044), curta: precisa e costuma chover, e embaixo a falta. Sem o dado, não aparece. */
function waterRows(t: Messages, option: Opcao) {
  const agua = option.agua
  if (!agua) return []
  const w = t.suggestion.water
  const mm = (value: number) => String(value)
  return [
    {
      label: w.title,
      icon: <DropIcon />,
      iconTone: 'blue' as const,
      value: `${w.need(mm(agua.precisa_mm))} · ${w.rain(mm(agua.chove_mm))}`,
      extra:
        agua.falta_normal_mm > 0
          ? w.short(mm(agua.falta_normal_mm), mm(agua.falta_seco_mm))
          : w.noShort(mm(agua.falta_seco_mm)),
    },
  ]
}

/**
 * Aba Comparar (antes "Todas as opções", tarefa 0044): a ordem segue o objetivo do produtor, cada cartão tem a
 * imagem da planta, o selo de sede e a linha Água. A S5b refaz o conteúdo (até 3 culturas lado a lado).
 */
export function OptionsView({ t, nav, status, onRetry, summary, rain }: OptionsViewProps) {
  const o = t.options
  return (
    <div className={layout.page}>
      <AnswerHeader t={t} nav={nav} />
      <PageHeading title={t.suggestion.compareTitle} />
      {status === 'loading' && <FlowLoading label={t.common.loading} />}
      {status === 'error' && <FlowError t={t} message={t.common.loadError} onRetry={onRetry} />}
      {status === 'outside' && <FlowOutside t={t} />}
      {status === 'ready' && summary && (
        <>
          <LateWarning t={t} late={summary.late} />
          <div className={layout.optionGrid}>
            {summary.options.map((option, index) => (
              <OptionCompareCard
                key={option.id}
                rank={o.rank(index + 1)}
                name={option.nome}
                highlighted={index === 0 && option.na_janela}
                unavailable={option.na_janela ? undefined : o.outOfWindowTitle}
                media={<PlantImage plant={option.id} label={t.suggestion.plantImage(option.nome)} size={64} />}
                badge={option.agua ? <ThirstBadge level={option.agua.sede}>{t.suggestion.thirst[option.agua.sede]}</ThirstBadge> : undefined}
                rows={[
                  {
                    label: t.axes.chuva,
                    value: option.chuva.texto,
                    icon: <DropIcon />,
                    iconTone: 'blue',
                    extra: <RainYears t={t} option={option} />,
                    pill: <StatusPill rotulo={option.chuva.rotulo}>{t.labels[option.chuva.rotulo]}</StatusPill>,
                  },
                  ...waterRows(t, option),
                  ...futureRows(t, option),
                  {
                    label: t.axes.renda,
                    value: option.renda.texto,
                    icon: <GrainIcon />,
                    extra: option.renda.risco,
                    pill: <StatusPill rotulo={option.renda.rotulo}>{t.labels[option.renda.rotulo]}</StatusPill>,
                  },
                  {
                    label: t.axes.terra,
                    value: option.terra.texto,
                    icon: <SoilIcon />,
                    pill: <StatusPill rotulo={option.terra.rotulo}>{t.labels[option.terra.rotulo]}</StatusPill>,
                  },
                ]}
              />
            ))}
            <OptionCompareCard
              rank={o.rank(summary.options.length + 1)}
              name={t.crops.names.pousio}
              media={<PlantImage plant="pousio" label={t.suggestion.plantImage(t.crops.names.pousio)} size={64} />}
              rows={[
                { label: t.axes.chuva, value: o.fallowRain, icon: <DropIcon />, iconTone: 'blue' },
                { label: t.axes.renda, value: o.fallowIncome, icon: <GrainIcon /> },
                { label: t.axes.terra, value: o.fallowSoil, icon: <SoilIcon /> },
              ]}
            />
          </div>
          <p className={layout.muted}>
            {o.legend(rainPeriodText(t, rain?.years ?? summary.options[0]?.chuva.anos ?? 0, rain))}
          </p>
        </>
      )}
    </div>
  )
}
