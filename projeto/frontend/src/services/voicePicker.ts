import type { Lang } from '../i18n/language'

export type VoiceLike = { name: string; lang: string }

/**
 * Vozes que nunca usamos: as "de efeito" do macOS (Bubbles, Zarvox…) e as antigas e robóticas.
 * Sem escolher a voz, o Chrome no Mac pode pegar uma destas para en-US.
 */
const EXCLUDED = new Set([
  'albert',
  'bad news',
  'bahh',
  'bells',
  'boing',
  'bubbles',
  'cellos',
  'good news',
  'jester',
  'organ',
  'pipe organ',
  'superstar',
  'trinoids',
  'whisper',
  'wobble',
  'zarvox',
  'deranged',
  'hysterical',
  'princess',
  'fred',
  'junior',
  'kathy',
  'ralph',
  'agnes',
  'bruce',
  'vicki',
  'victoria',
])

/** Sintéticas mais novas do macOS: aceitáveis só se não houver nada melhor. */
const LOW_QUALITY = new Set(['eddy', 'flo', 'grandma', 'grandpa', 'reed', 'rocko', 'sandy', 'shelley'])

/** Vozes do sistema conhecidas por soarem naturais. */
const KNOWN_GOOD = new Set([
  'samantha',
  'ava',
  'allison',
  'susan',
  'tom',
  'nicky',
  'zoe',
  'evan',
  'nathan',
  'noelle',
  'joelle',
  'aaron',
  'alex',
  'daniel',
  'karen',
  'moira',
  'serena',
  'kate',
  'oliver',
  'tessa',
  'luciana',
  'felipe',
  'fernanda',
])

const TARGET: Record<Lang, { exact: string; family: string }> = {
  pt: { exact: 'pt-br', family: 'pt' },
  en: { exact: 'en-us', family: 'en' },
}

const normalizeLang = (lang: string) => lang.replace('_', '-').toLowerCase()

/** "Luciana (Português (Brasil))" → "luciana" */
const baseName = (name: string) => name.split('(')[0].trim().toLowerCase()

function quality(name: string): number | null {
  const base = baseName(name)
  if (EXCLUDED.has(base)) return null
  if (/natural|neural|online/i.test(name)) return 100 // Microsoft Edge "Online (Natural)"
  if (/premium|enhanced|aprimorad|siri/i.test(name)) return 90 // vozes baixadas no macOS/iOS
  if (/^google/i.test(name)) return 80 // vozes do Chrome
  if (KNOWN_GOOD.has(base)) return 70
  if (/^microsoft/i.test(name)) return 60 // vozes padrão do Windows
  if (LOW_QUALITY.has(base)) return 30
  return 50
}

/**
 * Escolhe a voz mais natural disponível para o idioma ("Ouvir", RF-17). Cada aparelho tem vozes
 * diferentes (Mac, Windows, Android, iPhone), então a escolha é por qualidade, não por nome fixo.
 * Devolve null quando não há voz aceitável: aí o navegador decide sozinho.
 */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], lang: Lang): T | null {
  const target = TARGET[lang]
  let best: T | null = null
  let bestScore = -1
  for (const voice of voices) {
    const voiceLang = normalizeLang(voice.lang)
    if (voiceLang !== target.exact && !voiceLang.startsWith(`${target.family}-`) && voiceLang !== target.family) {
      continue
    }
    const score = quality(voice.name)
    if (score === null) continue
    const total = score + (voiceLang === target.exact ? 5 : 0)
    if (total > bestScore) {
      best = voice
      bestScore = total
    }
  }
  return best
}
