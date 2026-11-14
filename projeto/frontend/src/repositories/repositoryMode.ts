export type ApiMode = 'mock' | 'http'

/**
 * A API real é o padrão: sem a variável, nenhuma tela mostra dado que não veio da API.
 * Os dados de exemplo (`repositories/mocks/`) só entram com `VITE_API_MODE=mock` explícito, e aí
 * todas as telas mostram o aviso de demonstração. Health e crop-options são sempre http.
 */
export function resolveApiMode(value: string | undefined): ApiMode {
  return value === 'mock' ? 'mock' : 'http'
}
