import { useCallback, useEffect, useState } from 'react'
import type { Lang } from '../i18n/language'
import { speechService, type SpeechService } from '../services/speechService'

export type ListenState = {
  supported: boolean
  speaking: boolean
  toggle: () => void
}

/** Controller do botão "Ouvir": lê o texto da tela atual e para quando tocado de novo. */
export function useListen(
  lang: Lang,
  getText: () => string,
  service: SpeechService = speechService,
): ListenState {
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => () => service.stop(), [service])

  const toggle = useCallback(() => {
    if (speaking) {
      service.stop()
      setSpeaking(false)
      return
    }
    service.speak(getText(), lang, () => setSpeaking(false))
    setSpeaking(true)
  }, [speaking, service, getText, lang])

  return { supported: service.isSupported(), speaking, toggle }
}
