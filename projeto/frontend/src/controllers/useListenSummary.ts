import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang } from '../i18n/language'
import { speechService, type SpeechService } from '../services/speechService'

export type ListenSummaryState = {
  /** O navegador tem voz (Web Speech API). Sem voz, o "Ouvir resumo" não aparece. */
  supported: boolean
  speaking: boolean
  toggle: () => void
}

/**
 * Controller do "Ouvir resumo" (regra geral da remodelagem, tarefa 0052): cada tela fala só o seu resumo
 * curto (2 ou 3 frases, em pt e en), nunca a tela inteira. Tocar de novo para a fala; trocar o idioma
 * (ou o resumo) e sair da tela também param. Usado com o componente `ListenSummary` do design system.
 */
export function useListenSummary(
  text: string,
  lang: Lang,
  service: SpeechService = speechService,
): ListenSummaryState {
  const key = `${lang}\n${text}`
  const [speakingKey, setSpeakingKey] = useState<string | null>(null)
  // Cada fala tem a sua vez: o fim de uma fala antiga (cancelada) não desliga a fala nova.
  const turn = useRef(0)

  useEffect(
    () => () => {
      turn.current += 1
      service.stop()
      setSpeakingKey(null)
    },
    [key, service],
  )

  const speaking = speakingKey === key

  const toggle = useCallback(() => {
    turn.current += 1
    if (speaking) {
      service.stop()
      setSpeakingKey(null)
      return
    }
    const mine = turn.current
    service.speak(text, lang, () => {
      if (turn.current === mine) setSpeakingKey(null)
    })
    setSpeakingKey(key)
  }, [speaking, service, text, lang, key])

  return { supported: service.isSupported(), speaking, toggle }
}
