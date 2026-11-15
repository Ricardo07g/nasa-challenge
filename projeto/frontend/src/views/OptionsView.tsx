import { ChipGroup } from '../design-system/components/Choice'
import { OptionCompareCard, PageHeading } from '../design-system/components/Content'
import { AnswerTabs, BackLink, type AnswerTab } from '../design-system/components/Navigation'
import { NotConnected, StatusPill } from '../design-system/components/Status'
import { ClimateIcon, DropIcon, MoneyIcon, SoilIcon } from '../design-system/icons'
import type { Messages } from '../i18n/messages.pt'
import type { Eixo, Opcao } from '../models/recomendacao'
import { futureSummary, type LateSummary } from '../services/recomendacaoRules'
import type { RainSummary } from '../services/satelliteService'
import { FlowError, FlowLoading, FlowOutside, LateWarning } from './FlowStates'
import type { ScreenStatus } from '../models/screenStatus'
import { rainPeriodText } from './rainPeriod'
import { RainYears, YearDetailNotConnected } from './RainYears'
import layout from './layout.module.css'

export type OptionsViewProps = {
  t: Messages
  nav: { label: string; tabs: AnswerTab[]; backTo: string }
  status: ScreenStatus
  onRetry: () => void
  axis: Eixo | null
  onAxis: (axis: Eixo | null) => void
  summary: { options: Opcao[]; late: LateSummary } | null
  /** Anos e período da chuva (do talhão), para a legenda dos quadrinhos. */
  rain: RainSummary | null
}

const AXES: readonly Eixo[] = ['chuva', 'dinheiro', 'terra']

/** Clima de 2041–2060 da opção, no mesmo formato do cartão da resposta; sem o CMIP6, "Ainda não conectado". */
function futureRow(t: Messages, option: Opcao) {
  const future = futureSummary(option)
  return {
    label: t.answer.future,
    icon: <ClimateIcon />,
    iconTone: 'blue' as const,
    value: future ? t.answer.futureYears(future.good, future.total, future.range) : undefined,
    extra: future ? undefined : <NotConnected label={t.common.notConnected} />,
  }
}

/** Tela 6 "Todas as opções": reordenar, um cartão por opção e "Deixar parado" como linha de base. */
export function OptionsView({ t, nav, status, onRetry, axis, onAxis, summary, rain }: OptionsViewProps) {
  const o = t.options
  return (
    <div className={layout.page}>
      <BackLink to={nav.backTo}>{t.nav.back}</BackLink>
      <AnswerTabs label={nav.label} tabs={nav.tabs} />
      <PageHeading title={o.title} />
      {status === 'loading' && <FlowLoading label={t.common.loading} />}
      {status === 'error' && <FlowError t={t} message={t.common.loadError} onRetry={onRetry} />}
      {status === 'outside' && <FlowOutside t={t} />}
      {status === 'ready' && summary && (
        <>
          <div className={layout.stack}>
            <p>{o.sortLabel}</p>
            <ChipGroup
              label={o.sortLabel}
              options={AXES.map((value) => ({ value, label: t.axes[value] }))}
              value={axis}
              onChange={onAxis}
              allowDeselect
            />
          </div>
          <LateWarning t={t} late={summary.late} />
          <div className={layout.optionGrid}>
            {summary.options.map((option, index) => (
              <OptionCompareCard
                key={option.id}
                rank={o.rank(index + 1)}
                name={option.nome}
                highlighted={index === 0 && option.na_janela}
                unavailable={option.na_janela ? undefined : o.outOfWindowTitle}
                rows={[
                  {
                    label: t.axes.chuva,
                    value: option.chuva.texto,
                    icon: <DropIcon />,
                    iconTone: 'blue',
                    extra: <RainYears t={t} option={option} />,
                    pill: <StatusPill rotulo={option.chuva.rotulo}>{t.labels[option.chuva.rotulo]}</StatusPill>,
                  },
                  futureRow(t, option),
                  {
                    label: t.axes.dinheiro,
                    value: option.dinheiro.texto,
                    icon: <MoneyIcon />,
                    pill: <StatusPill rotulo={option.dinheiro.rotulo}>{t.labels[option.dinheiro.rotulo]}</StatusPill>,
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
              rows={[
                { label: t.axes.chuva, value: o.fallowRain, icon: <DropIcon />, iconTone: 'blue' },
                { label: t.axes.dinheiro, value: o.fallowMoney, icon: <MoneyIcon /> },
                { label: t.axes.terra, value: o.fallowSoil, icon: <SoilIcon /> },
              ]}
            />
          </div>
          <p className={layout.muted}>
            {o.legend(rainPeriodText(t, rain?.years ?? summary.options[0]?.chuva.anos ?? 0, rain))}
          </p>
          {!summary.options.some((option) => option.anos_detalhe?.length) && <YearDetailNotConnected t={t} />}
        </>
      )}
    </div>
  )
}
