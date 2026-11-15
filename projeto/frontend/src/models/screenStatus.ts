/** Estado de uma tela que depende de dados: "outside" = o ponto está fora da área com dados preparados. */
export type ScreenStatus = 'loading' | 'ready' | 'error' | 'outside'

/** Estado de um bloco: o dado que a API ainda não manda vira "not-connected" (o bloco não aparece, decisão D2), não erro. */
export type BlockStatus = 'loading' | 'ready' | 'error' | 'not-connected'
