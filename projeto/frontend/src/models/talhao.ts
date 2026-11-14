/** Tipos do contrato `GET /api/talhao` (plano técnico do backend, §3.1). */

export type Colheita = 'cedo' | 'meio' | 'tarde'

export const COLHEITAS: readonly Colheita[] = ['cedo', 'meio', 'tarde']

export type Textura = 'arenoso' | 'medio' | 'argiloso'

export const TEXTURAS: readonly Textura[] = ['arenoso', 'medio', 'argiloso']

export type Ponto = { lat: number; lon: number }

export type SituacaoAno = 'plantou' | 'parado' | 'incerto'

export type Talhao = {
  ponto: Ponto
  celula_id: string | null
  dentro_da_area: boolean
  solo: { textura: Textura; cad_mm: number; fonte: 'soilgrids' | 'padrao' | 'usuario' } | null
  colheita_sugerida: { faixa: Colheita; fonte: 'ndvi_modis' | 'padrao'; anos_usados: number } | null
  historico: {
    anos: { ano: number; situacao: SituacaoAno; ndvi_max: number }[]
    parado: number
    total: number
    fonte: string
  } | null
  dados: { fonte: string; periodo: string; cenario?: string; modelos?: number }[]
}
