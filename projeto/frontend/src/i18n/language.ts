export type Lang = 'pt' | 'en'

export const LANG_STORAGE_KEY = 'raiz-orbital:lang'

function isLang(value: unknown): value is Lang {
  return value === 'pt' || value === 'en'
}

/** Escolha salva > idioma do navegador (pt* → pt) > inglês (RF-12: juízes em inglês). */
export function detectLanguage(browserLanguages: readonly string[], stored: string | null): Lang {
  if (isLang(stored)) return stored
  return browserLanguages.some((language) => language.toLowerCase().startsWith('pt')) ? 'pt' : 'en'
}

export function htmlLang(lang: Lang): string {
  return lang === 'pt' ? 'pt-BR' : 'en'
}

export function speechLang(lang: Lang): string {
  return lang === 'pt' ? 'pt-BR' : 'en-US'
}
