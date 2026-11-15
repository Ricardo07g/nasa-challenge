import { describe, expect, it, vi } from 'vitest'
import { createSpeechService } from './speechService'

class FakeUtterance {
  text: string
  lang = ''
  rate = 1
  voice: unknown = null
  onend: (() => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

function fakeSynth(voices: { name: string; lang: string }[] = []) {
  return { speak: vi.fn(), cancel: vi.fn(), getVoices: vi.fn(() => voices) }
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

  it('fala um pouco mais devagar que o normal (velocidade 0,95, "Ouvir resumo")', () => {
    const synth = fakeSynth()
    const service = createSpeechService(synth, FakeUtterance)

    service.speak('Olá', 'pt', () => {})

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance
    expect(utterance.rate).toBe(0.95)
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

  it('usa a melhor voz do idioma em vez de deixar o navegador escolher', () => {
    const samantha = { name: 'Samantha', lang: 'en-US' }
    const synth = fakeSynth([{ name: 'Albert', lang: 'en-US' }, samantha])
    const service = createSpeechService(synth, FakeUtterance)

    service.speak('Hello', 'en', () => {})

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance
    expect(utterance.voice).toBe(samantha)
  })

  it('sem voz boa disponível, não força nenhuma (fica a do navegador)', () => {
    const synth = fakeSynth([{ name: 'Zarvox', lang: 'en-US' }])
    const service = createSpeechService(synth, FakeUtterance)

    service.speak('Hello', 'en', () => {})

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance
    expect(utterance.voice).toBeNull()
  })

  it('lê texto longo em partes (o Chrome corta falas longas) e só avisa o fim depois da última', () => {
    const synth = fakeSynth([{ name: 'Google US English', lang: 'en-US' }])
    const service = createSpeechService(synth, FakeUtterance)
    const onEnd = vi.fn()
    const sentence = 'NASA satellites looked at twenty years of rain on your field and found the best option.'
    const text = Array.from({ length: 6 }, () => sentence).join(' ')

    service.speak(text, 'en', onEnd)

    const parts = synth.speak.mock.calls.map((call) => call[0] as FakeUtterance)
    expect(parts.length).toBeGreaterThan(1)
    expect(parts.map((part) => part.text).join(' ')).toBe(text)
    for (const part of parts) expect(part.text.length).toBeLessThanOrEqual(220)
    parts[0].onend?.()
    expect(onEnd).not.toHaveBeenCalled()
    parts[parts.length - 1].onend?.()
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  it('para de falar', () => {
    const synth = fakeSynth()
    const service = createSpeechService(synth, FakeUtterance)

    service.stop()

    expect(synth.cancel).toHaveBeenCalled()
  })
})
