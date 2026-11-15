import { useCallback, useState } from 'react'
import { useLocation } from 'react-router'
import { CREDITS, type CreditsContent } from '../content/credits'
import type { AppFooterProps } from '../design-system/components/Footer'
import type { AppHeaderProps } from '../design-system/components/Header'
import { useI18n } from '../i18n/useI18n'
import { apiMode as currentApiMode } from '../repositories'
import type { ApiMode } from '../repositories/repositoryMode'
import { avisosService, type AvisosService } from '../services/avisosService'
import { keepFlowQuery } from '../services/flowParams'
import { useAlertsBadge } from './useAlertsBadge'

export type CreditsState = {
  open: boolean
  content: CreditsContent
  closeLabel: string
  onOpen: () => void
  onClose: () => void
}

/**
 * Controller da moldura comum a todas as telas (tarefa 0052): o cabeçalho (Comunidade, Avisos e PT | EN),
 * o rodapé (na Início sem o link "Como a conta é feita", que lá é a faixa do agrônomo), o modal global de
 * créditos e, com os dados de exemplo (VITE_API_MODE=mock), o aviso fixo de demonstração.
 */
export function useShellController(
  apiMode: ApiMode = currentApiMode,
  avisos: AvisosService = avisosService,
): {
  header: AppHeaderProps
  footer: AppFooterProps
  credits: CreditsState
  demoNotice: string | null
} {
  const { lang, messages: t, toggleLang } = useI18n()
  const { pathname, search } = useLocation()
  // Tela "Avisos" (tarefa 0046): o botão do cabeçalho com o número de avisos ativos
  const alerts = useAlertsBadge(avisos)
  const [creditsOpen, setCreditsOpen] = useState(false)
  const openCredits = useCallback(() => setCreditsOpen(true), [])
  const closeCredits = useCallback(() => setCreditsOpen(false), [])
  const isHome = pathname === '/'

  return {
    header: {
      homeLabel: t.header.home,
      slogan: t.header.slogan,
      navLabel: t.header.navLabel,
      community: { label: t.header.community, to: `/comunidade${keepFlowQuery(search)}` },
      alerts: {
        label: t.alerts.headerLabel,
        to: alerts.to,
        count: alerts.count,
        countLabel: alerts.count !== null ? t.alerts.headerCount(alerts.count) : null,
      },
      lang: { current: lang, onToggle: toggleLang, label: t.header.langToggleLabel },
    },
    footer: {
      disclaimer: t.common.disclaimer,
      credits: { label: t.footer.credits, onOpen: openCredits },
      project: t.footer.project,
      method: isHome ? null : { label: t.footer.method, to: `/como-funciona${keepFlowQuery(search)}` },
    },
    credits: {
      open: creditsOpen,
      content: CREDITS[lang],
      closeLabel: t.common.close,
      onOpen: openCredits,
      onClose: closeCredits,
    },
    demoNotice: apiMode === 'mock' ? t.common.demoMode : null,
  }
}
