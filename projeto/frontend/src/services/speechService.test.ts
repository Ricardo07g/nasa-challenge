import { describe, expect, it, vi } from 'vitest'
import { createSpeechService } from './speechService'

class FakeUtterance {
  text: string
  lang = ''
  onend: (() => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

function fakeSynth() {
  return { speak: vi.fn(), cancel: vi.fn() }
}

describe('speechService', () => {
  it('não é suportado quando o navegador não tem síntese de voz', () => {
    const service = createSpeechService(undefined, undefined)

    expect(service.isSupported()).toBe(false)
  })

  it('fala o texto no idioma pedido, cancelando a fala anterior', () => {
    const synth = fakeSynth()
    const service = createSpeechService(synth, FakeUtterance)

    service.speak('Olá', 'pt', () => {})

    expect(synth.cancel).toHaveBeenCalled()
    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance
    expect(utterance.text).toBe('Olá')
    expect(utterance.lang).toBe('pt-BR')
  })

  it('avisa quando termina de falar', () => {
    const synth = fakeSynth()
    const service = createSpeechService(synth, FakeUtterance)
    const onEnd = vi.fn()

    service.speak('Hello', 'en', onEnd)
    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance
    utterance.onend?.()

    expect(utterance.lang).toBe('en-US')
    expect(onEnd).toHaveBeenCalled()
  })

  it('para de falar', () => {
    const synth = fakeSynth()
    const service = createSpeechService(synth, FakeUtterance)

    service.stop()

    expect(synth.cancel).toHaveBeenCalled()
  })
})
