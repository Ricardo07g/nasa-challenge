import { useCallback } from 'react'
import { useLocation } from 'react-router'
import type { AppFooterProps } from '../design-system/components/Footer'
import type { AppHeaderProps } from '../design-system/components/Header'
import { useI18n } from '../i18n/useI18n'
import { apiMode as currentApiMode } from '../repositories'
import type { ApiMode } from '../repositories/repositoryMode'
import { avisosService, type AvisosService } from '../services/avisosService'
import { keepFlowQuery } from '../services/flowParams'
import { speechService, type SpeechService } from '../services/speechService'
import { telegramService, type TelegramService } from '../services/telegramService'
import { useAlertsBadge } from './useAlertsBadge'
import { useListen } from './useListen'
import { useTelegramLink } from './useTelegramLink'

/** Texto que o "Ouvir" lê: o conteúdo principal da tela atual. */
function mainText(): string {
  const main = document.querySelector('main')
  return (main?.innerText || main?.textContent || '').trim()
}

/**
 * Controller da moldura comum a todas as telas: cabeçalho com Ouvir e PT | EN, o rodapé e, com os
 * dados de exemplo (VITE_API_MODE=mock), o aviso fixo de demonstração.
 */
export function useShellController(
  speech: SpeechService = speechService,
  telegram: TelegramService = telegramService,
  apiMode: ApiMode = currentApiMode,
  avisos: AvisosService = avisosService,
): {
  header: AppHeaderProps
  footer: AppFooterProps
  demoNotice: string | null
} {
  const { lang, messages: t, toggleLang } = useI18n()
  const getText = useCallback(() => mainText(), [])
  const listen = useListen(lang, getText, speech)
  const { search } = useLocation()
  const telegramHref = useTelegramLink(telegram)
  // Tela "Avisos" (tarefa 0046): o botão do cabeçalho com o número de avisos ativos
  const alerts = useAlertsBadge(avisos)

  return {
    header: {
      homeLabel: t.header.home,
      slogan: t.header.slogan,
      community: { label: t.header.community, to: `/comunidade${keepFlowQuery(search)}` },
      alerts: {
        label: t.alerts.headerLabel,
        to: alerts.to,
        count: alerts.count,
        countLabel: alerts.count !== null ? t.alerts.headerCount(alerts.count) : null,
      },
      telegram: telegramHref ? { href: telegramHref, label: t.telegram.open } : undefined,
      listen: {
        supported: listen.supported,
        speaking: listen.speaking,
        onToggle: listen.toggle,
        label: t.header.listenLabel,
        stopLabel: t.header.stopLabel,
        text: t.header.listen,
        stopText: t.header.stop,
      },
      lang: { current: lang, onToggle: toggleLang, label: t.header.langToggleLabel },
    },
    footer: {
      disclaimer: t.common.disclaimer,
      agronomist: t.footer.agronomist,
      agronomistTo: `/como-funciona${keepFlowQuery(search)}`,
      project: t.footer.project,
    },
    demoNotice: apiMode === 'mock' ? t.common.demoMode : null,
  }
}
