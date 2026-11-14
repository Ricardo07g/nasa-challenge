export type ApiMode = 'mock' | 'http'

/**
 * `VITE_API_MODE=http` liga a API real; qualquer outra coisa usa os dados de exemplo.
 * Vale só para talhão, recomendação e exemplo: health e crop-options já existem e são sempre http.
 */
export function resolveApiMode(value: string | undefined): ApiMode {
  return value === 'http' ? 'http' : 'mock'
}
