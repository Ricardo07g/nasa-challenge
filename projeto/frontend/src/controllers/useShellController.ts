import { useCallback } from 'react'
import { useLocation } from 'react-router'
import type { AppFooterProps } from '../design-system/components/Footer'
import type { AppHeaderProps } from '../design-system/components/Header'
import { useI18n } from '../i18n/useI18n'
import { keepFlowQuery } from '../services/flowParams'
import { speechService, type SpeechService } from '../services/speechService'
import { useListen } from './useListen'

/** Texto que o "Ouvir" lê: o conteúdo principal da tela atual. */
function mainText(): string {
  const main = document.querySelector('main')
  return (main?.innerText || main?.textContent || '').trim()
}

/** Controller da moldura comum a todas as telas: cabeçalho com Ouvir e PT | EN, e o rodapé. */
export function useShellController(speech: SpeechService = speechService): {
  header: AppHeaderProps
  footer: AppFooterProps
} {
  const { lang, messages: t, toggleLang } = useI18n()
  const getText = useCallback(() => mainText(), [])
  const listen = useListen(lang, getText, speech)
  const { search } = useLocation()

  return {
    header: {
      homeLabel: t.header.home,
      slogan: t.header.slogan,
      community: { label: t.header.community, to: `/comunidade${keepFlowQuery(search)}` },
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
      project: t.footer.project,
    },
  }
}
