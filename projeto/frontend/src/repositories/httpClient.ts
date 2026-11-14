import type { Lang } from '../i18n/language'

export type GetJsonOptions = { lang?: Lang }

export type GetJson = <T>(path: string, options?: GetJsonOptions) => Promise<T>

/**
 * Único lugar do front que fala HTTP. Sempre caminhos relativos (/api/...):
 * o proxy do Vite encaminha para o backend. Com `lang`, pede os textos da API nesse idioma (RF-12).
 */
export async function getJson<T>(path: string, options?: GetJsonOptions): Promise<T> {
  const response = options?.lang
    ? await fetch(path, { headers: { 'Accept-Language': options.lang } })
    : await fetch(path)
  if (!response.ok) {
    throw new Error(`GET ${path} falhou com status ${response.status}`)
  }
  return (await response.json()) as T
}
