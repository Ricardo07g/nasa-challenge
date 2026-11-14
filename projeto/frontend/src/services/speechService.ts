import { speechLang, type Lang } from '../i18n/language'
import { pickVoice, type VoiceLike } from './voicePicker'

type SynthLike = {
  speak(utterance: never): void
  cancel(): void
  getVoices?(): VoiceLike[]
}

type UtteranceLike = {
  lang: string
  voice: unknown
  onend: (() => void) | null
}

type UtteranceConstructor = new (text: string) => UtteranceLike

export type SpeechService = {
  isSupported(): boolean
  speak(text: string, lang: Lang, onEnd: () => void): void
  stop(): void
}

const MAX_PART = 200

/** Quebra um trecho grande demais nos espaços, sem cortar palavras. */
function splitLong(sentence: string): string[] {
  const parts: string[] = []
  let current = ''
  for (const word of sentence.split(' ')) {
    if (current && current.length + 1 + word.length > MAX_PART) {
      parts.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) parts.push(current)
  return parts
}

/**
 * Divide o texto em partes de até ~200 caracteres, respeitando o fim das frases. O Chrome corta
 * falas longas (cerca de 15 s) nas vozes do Google; em partes, a leitura vai até o fim.
 */
export function splitForSpeech(text: string): string[] {
  const sentences = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?…:;])\s+/).filter(Boolean)
  const parts: string[] = []
  let current = ''
  for (const sentence of sentences.flatMap((s) => (s.length > MAX_PART ? splitLong(s) : [s]))) {
    if (current && current.length + 1 + sentence.length > MAX_PART) {
      parts.push(current)
      current = sentence
    } else {
      current = current ? `${current} ${sentence}` : sentence
    }
  }
  if (current) parts.push(current)
  return parts
}

/** "Ouvir" (RF-17): leitura em voz pelo próprio navegador (Web Speech API), com a melhor voz do aparelho. */
export function createSpeechService(
  synth: SynthLike | undefined = globalThis.speechSynthesis as SynthLike | undefined,
  Utterance: UtteranceConstructor | undefined = globalThis.SpeechSynthesisUtterance as
    | UtteranceConstructor
    | undefined,
): SpeechService {
  // O Chrome só carrega a lista de vozes na primeira consulta: pedir já deixa pronta para o clique.
  synth?.getVoices?.()

  return {
    isSupported: () => Boolean(synth && Utterance),
    speak(text, lang, onEnd) {
      if (!synth || !Utterance) return
      synth.cancel()
      const voice = pickVoice(synth.getVoices?.() ?? [], lang)
      const parts = splitForSpeech(text)
      if (parts.length === 0) {
        onEnd()
        return
      }
      // O navegador enfileira as partes; o fim só é avisado depois da última.
      parts.forEach((part, index) => {
        const utterance = new Utterance(part)
        utterance.lang = speechLang(lang)
        utterance.voice = voice
        utterance.onend = index === parts.length - 1 ? onEnd : null
        synth.speak(utterance as never)
      })
    },
    stop() {
      synth?.cancel()
    },
  }
}

export const speechService = createSpeechService()
