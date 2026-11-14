import { describe, expect, it } from 'vitest'
import { pickVoice, type VoiceLike } from './voicePicker'

const voice = (name: string, lang: string): VoiceLike => ({ name, lang })

// Lista parecida com a de um Mac: vozes de efeito primeiro (ordem alfabética), depois as boas.
const MAC_EN = [
  voice('Albert', 'en-US'),
  voice('Bad News', 'en-US'),
  voice('Bubbles', 'en-US'),
  voice('Eddy (English (US))', 'en-US'),
  voice('Fred', 'en-US'),
  voice('Samantha', 'en-US'),
  voice('Zarvox', 'en-US'),
]

describe('pickVoice', () => {
  it('nunca escolhe voz de efeito ou robótica do macOS', () => {
    expect(pickVoice(MAC_EN, 'en')?.name).toBe('Samantha')
  })

  it('prefere as vozes de alta qualidade, nesta ordem: natural > premium > Google > conhecidas', () => {
    const voices = [
      ...MAC_EN,
      voice('Google US English', 'en-US'),
      voice('Ava (Premium)', 'en-US'),
      voice('Microsoft Aria Online (Natural) - English (United States)', 'en-US'),
    ]

    expect(pickVoice(voices, 'en')?.name).toBe('Microsoft Aria Online (Natural) - English (United States)')
    expect(pickVoice(voices.slice(0, -1), 'en')?.name).toBe('Ava (Premium)')
    expect(pickVoice(voices.slice(0, -2), 'en')?.name).toBe('Google US English')
  })

  it('no português, escolhe a Luciana entre as vozes do Mac (aceita pt_BR e pt-BR)', () => {
    const voices = [
      voice('Eddy (Português (Brasil))', 'pt_BR'),
      voice('Grandma (Português (Brasil))', 'pt_BR'),
      voice('Luciana', 'pt-BR'),
      voice('Samantha', 'en-US'),
    ]

    expect(pickVoice(voices, 'pt')?.name).toBe('Luciana')
  })

  it('prefere o sotaque exato (en-US antes de en-GB), mas aceita outro do mesmo idioma', () => {
    expect(pickVoice([voice('Daniel', 'en-GB'), voice('Samantha', 'en-US')], 'en')?.name).toBe('Samantha')
    expect(pickVoice([voice('Daniel', 'en-GB')], 'en')?.name).toBe('Daniel')
  })

  it('uma voz desconhecida vale mais que as sintéticas antigas, e estas mais que nada', () => {
    expect(pickVoice([voice('Eddy (Inglês (EUA))', 'en-US'), voice('Karen', 'en-US')], 'en')?.name).toBe('Karen')
    expect(pickVoice([voice('Eddy (Inglês (EUA))', 'en-US')], 'en')?.name).toBe('Eddy (Inglês (EUA))')
  })

  it('sem voz aceitável no idioma, devolve null (o navegador decide)', () => {
    expect(pickVoice([voice('Albert', 'en-US'), voice('Zarvox', 'en-US')], 'en')).toBeNull()
    expect(pickVoice([voice('Samantha', 'en-US')], 'pt')).toBeNull()
    expect(pickVoice([], 'pt')).toBeNull()
  })
})
