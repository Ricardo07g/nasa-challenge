/**
 * Relatos da comunidade sem cadastro (seção 7 da remodelagem, tarefa 0047 do backend).
 * Contrato de `GET`/`POST /api/comunidade/relatos` e `DELETE /api/comunidade/relatos/{id}`.
 *
 * O relato guarda só a célula de 0,1° do ponto: `lat` e `lon` da resposta são o centro da célula,
 * nunca o ponto marcado. Sem texto livre: todo valor vem das listas abaixo ou é um número.
 */

export type TipoRelato = 'plantio' | 'chuva' | 'evento'

/** "O que plantei depois da soja": as culturas do `culturas.yaml`, "outra" e "deixei parado" (`pousio`). */
export const CULTURAS_RELATO = [
  'milho_safrinha',
  'milho_braquiaria',
  'sorgo',
  'milheto',
  'crotalaria',
  'outra',
  'pousio',
] as const
export type CulturaRelato = (typeof CULTURAS_RELATO)[number]

/** "Como foi". */
export const RESULTADOS = ['bem', 'mais_ou_menos', 'perdi'] as const
export type Resultado = (typeof RESULTADOS)[number]

/** "Se perdeu, o motivo". */
export const MOTIVOS = ['seca', 'calor', 'geada', 'granizo', 'praga', 'outro'] as const
export type Motivo = (typeof MOTIVOS)[number]

/** "Aconteceu aqui". */
export const EVENTOS = ['fogo', 'granizo', 'geada', 'vendaval', 'enxurrada_erosao', 'praga_doenca'] as const
export type Evento = (typeof EVENTOS)[number]

/** Um relato da redondeza, como os vizinhos veem. */
export type RelatoComunidade = {
  id: string
  /** Aberto para os tipos futuros (oferta, troca, empréstimo): a tela ignora o que não conhece. */
  tipo: TipoRelato | (string & {})
  subtipo: string | null
  /** plantio: `ano`, `resultado`, `motivo`; chuva: `mm`; evento: nada. */
  valores: Record<string, unknown>
  celula: string
  /** Centro da célula de 0,1° (nunca o ponto marcado). */
  lat: number
  lon: number
  /** "AAAA-MM-DD" na chuva e no evento; `null` no plantio (o ano da safra vai em `valores`). */
  data_fato: string | null
  /** Enviado por este aparelho (pode apagar). */
  meu: boolean
  /** Só nos dados de demonstração (`VITE_API_MODE=mock`): a tela põe o selo "Exemplo". */
  exemplo?: boolean
}

export type RelatosVizinhos = {
  raio_km: number
  /** As últimas safras aceitas no relato de plantio. */
  anos_safra: number[]
  relatos: RelatoComunidade[]
}

/** O que o aparelho manda: o ponto marcado vai inteiro e o backend guarda só a célula. */
export type NovoRelato = {
  tipo: TipoRelato
  subtipo: string | null
  valores: Record<string, unknown>
  lat: number
  lon: number
  data_fato: string | null
}
