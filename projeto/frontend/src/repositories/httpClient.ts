import type { Lang } from '../i18n/language'

export type GetJsonOptions = { lang?: Lang }

export type GetJson = <T>(path: string, options?: GetJsonOptions) => Promise<T>

/** Erro da API: status HTTP e o `code` do corpo problem+json (ex.: OUTSIDE_AREA), quando houver. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | null

  constructor(path: string, status: number, code: string | null) {
    super(`GET ${path} falhou com status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** O ponto fica fora da área com dados preparados (404 OUTSIDE_AREA, ADR 0002). */
export function isOutsideArea(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404 && error.code === 'OUTSIDE_AREA'
}

async function readCode(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json()
    const code = (body as { code?: unknown } | null)?.code
    return typeof code === 'string' ? code : null
  } catch {
    return null
  }
}

/**
 * Único lugar do front que fala HTTP. Sempre caminhos relativos (/api/...):
 * o proxy do Vite encaminha para o backend. Com `lang`, pede os textos da API nesse idioma (RF-12).
 */
export async function getJson<T>(path: string, options?: GetJsonOptions): Promise<T> {
  const response = options?.lang
    ? await fetch(path, { headers: { 'Accept-Language': options.lang } })
    : await fetch(path)
  if (!response.ok) {
    throw new ApiError(path, response.status, await readCode(response))
  }
  return (await response.json()) as T
}
