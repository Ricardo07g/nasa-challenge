import type { ReactNode } from 'react'
import { Card } from '../design-system/components/Card'
import { ChipGroup } from '../design-system/components/Choice'
import { EventTimeline, PageHeading } from '../design-system/components/Content'
import { BackLink } from '../design-system/components/Navigation'
import {
  CheckCircleIcon,
  DropIcon,
  HeatIcon,
  NoRainIcon,
  RainIcon,
  SeedIcon,
  SproutIcon,
  WarningIcon,
} from '../design-system/icons'
import { formatDayMonth } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import type { SafraPassada, TipoEvento } from '../models/pastSeason'
import type { ScreenStatus } from '../models/screenStatus'
import { PAST_YEARS, isWarning, pastYearKind } from '../services/pastSeasonService'
import { FlowError, FlowLoading, FlowOutside } from './FlowStates'
import layout from './layout.module.css'
import { TelegramCard } from './TelegramCard'

export type PastSeasonViewProps = {
  t: Messages
  lang: Lang
  status: ScreenStatus
  onRetry: () => void
  backTo: string
  year: number
  onYear: (year: number) => void
  season: SafraPassada | null
  sampleData: boolean
  /** P5: link do bot do Telegram; null quando não está configurado. */
  telegramHref: string | null
}

const EVENT_ICON: Record<TipoEvento, ReactNode> = {
  semeadura: <SproutIcon />,
  sem_chuva: <NoRainIcon />,
  aviso_veranico: <WarningIcon />,
  fase_critica: <DropIcon />,
  voltou_chuva: <RainIcon />,
  aviso_calor: <HeatIcon />,
  colheita: <SeedIcon />,
}

/** Replay da safra passada (P4): linha do tempo com os avisos de veranico e calor que teriam chegado. */
export function PastSeasonView(props: PastSeasonViewProps) {
  const { t, lang, status, onRetry, backTo, year, onYear, season, sampleData, telegramHref } = props
  const p = t.past
  return (
    <div className={layout.page}>
      <BackLink to={backTo}>{t.nav.back}</BackLink>
      <PageHeading title={p.title(year)} subtitle={p.text(year)} />
      <ChipGroup
        label={p.choose}
        // "Ano seco"/"ano bom" é fixo (não vem da API): só com os dados de exemplo; com a API real, só o ano.
        options={PAST_YEARS.map((value) => ({
          value: String(value),
          label: sampleData ? p[pastYearKind(value)](value) : String(value),
        }))}
        value={String(year)}
        onChange={(value) => value && onYear(Number(value))}
      />
      {status === 'loading' && <FlowLoading label={t.common.loading} />}
      {status === 'error' && <FlowError t={t} message={t.common.loadError} onRetry={onRetry} />}
      {status === 'outside' && <FlowOutside t={t} />}
      {status === 'ready' && season && (
        <>
          <EventTimeline
            label={p.title(year)}
            events={season.eventos.map((evento) => ({
              key: `${evento.data}-${evento.tipo}`,
              date: formatDayMonth(lang, evento.data),
              icon: EVENT_ICON[evento.tipo],
              text: evento.texto,
              warning: isWarning(evento.tipo),
            }))}
          />
          {!season.eventos.some((evento) => isWarning(evento.tipo)) && (
            <Card tone="green">
              <p className={layout.iconLine}>
                <CheckCircleIcon />
                {p.noWarnings}
              </p>
            </Card>
          )}
          {telegramHref && <TelegramCard t={t} href={telegramHref} past />}
          {sampleData && <p className={layout.muted}>{p.note}</p>}
        </>
      )}
    </div>
  )
}
