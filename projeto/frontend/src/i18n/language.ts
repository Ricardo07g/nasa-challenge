export type Lang = 'pt' | 'en'

export const LANG_STORAGE_KEY = 'raiz-orbital:lang'

function isLang(value: unknown): value is Lang {
  return value === 'pt' || value === 'en'
}

/**
 * Escolha salva > inglês. Desde 15/11/2026 o inglês é o padrão do site (pedido do usuário; RF-12: os juízes leem em
 * inglês): o idioma do navegador não conta mais. Quem troca para PT no cabeçalho continua em PT (a escolha fica salva).
 */
export function detectLanguage(stored: string | null): Lang {
  return isLang(stored) ? stored : 'en'
}

export function htmlLang(lang: Lang): string {
  return lang === 'pt' ? 'pt-BR' : 'en'
}

export function speechLang(lang: Lang): string {
  return lang === 'pt' ? 'pt-BR' : 'en-US'
}
