export type ApiStatus = 'carregando' | 'ok' | 'fora do ar'

export type HealthResponse = {
  status: string
  // Commit que está no ar (COMMIT_SHA do deploy; "local" fora dele). Opcional: a API antiga não manda.
  commit?: string | null
}
