import { speechLang, type Lang } from '../i18n/language'

type SynthLike = {
  speak(utterance: never): void
  cancel(): void
}

type UtteranceLike = {
  lang: string
  onend: (() => void) | null
}

type UtteranceConstructor = new (text: string) => UtteranceLike

export type SpeechService = {
  isSupported(): boolean
  speak(text: string, lang: Lang, onEnd: () => void): void
  stop(): void
}

/** "Ouvir" (RF-17): leitura em voz pelo próprio navegador (Web Speech API). */
export function createSpeechService(
  synth: SynthLike | undefined = globalThis.speechSynthesis as SynthLike | undefined,
  Utterance: UtteranceConstructor | undefined = globalThis.SpeechSynthesisUtterance as
    | UtteranceConstructor
    | undefined,
): SpeechService {
  return {
    isSupported: () => Boolean(synth && Utterance),
    speak(text, lang, onEnd) {
      if (!synth || !Utterance) return
      synth.cancel()
      const utterance = new Utterance(text)
      utterance.lang = speechLang(lang)
      utterance.onend = onEnd
      synth.speak(utterance as never)
    },
    stop() {
      synth?.cancel()
    },
  }
}

export const speechService = createSpeechService()
