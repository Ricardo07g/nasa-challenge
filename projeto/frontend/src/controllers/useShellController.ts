import { useCallback } from 'react'
import type { AppHeaderProps } from '../design-system/components/Header'
import { useI18n } from '../i18n/useI18n'
import { speechService, type SpeechService } from '../services/speechService'
import { useListen } from './useListen'

/** Texto que o "Ouvir" lê: o conteúdo principal da tela atual. */
function mainText(): string {
  const main = document.querySelector('main')
  return (main?.innerText || main?.textContent || '').trim()
}

/** Controller da moldura comum a todas as telas: cabeçalho com Ouvir e PT | EN. */
export function useShellController(speech: SpeechService = speechService): { header: AppHeaderProps } {
  const { lang, messages: t, toggleLang } = useI18n()
  const getText = useCallback(() => mainText(), [])
  const listen = useListen(lang, getText, speech)

  return {
    header: {
      homeLabel: t.header.home,
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
  }
}
