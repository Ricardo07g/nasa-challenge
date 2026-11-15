import type { ReactNode } from 'react'
import { EventTimeline } from '../design-system/components/Content'
import { DropIcon, HeatIcon, NoRainIcon, RainIcon, SeedIcon, SproutIcon, WarningIcon } from '../design-system/icons'
import { formatDayMonth } from '../i18n/format'
import type { Lang } from '../i18n/language'
import type { SafraPassada, TipoEvento } from '../models/pastSeason'
import { isWarning } from '../services/pastSeasonService'

const EVENT_ICON: Record<TipoEvento, ReactNode> = {
  semeadura: <SproutIcon />,
  sem_chuva: <NoRainIcon />,
  aviso_veranico: <WarningIcon />,
  fase_critica: <DropIcon />,
  voltou_chuva: <RainIcon />,
  aviso_calor: <HeatIcon />,
  colheita: <SeedIcon />,
}

/**
 * A safra de um ano, dia a dia, com os avisos de veranico e calor que teriam chegado (replay do P4). Era a
 * tela solta `/safra-passada`; desde a tarefa 0044 é parte do detalhe de cada ano do explorador.
 */
export function SeasonTimeline({ label, lang, season }: { label: string; lang: Lang; season: SafraPassada }) {
  return (
    <EventTimeline
      label={label}
      events={season.eventos.map((evento) => ({
        key: `${evento.data}-${evento.tipo}`,
        date: formatDayMonth(lang, evento.data),
        icon: EVENT_ICON[evento.tipo],
        text: evento.texto,
        warning: isWarning(evento.tipo),
      }))}
    />
  )
}
