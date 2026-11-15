import type { CropId, Sede, SinalOutono } from './recomendacao'
import type { Colheita, Textura } from './talhao'

/**
 * Contrato de `GET /api/plano?lat&lon&anos=a,b,c[&colheita][&solo]` (tarefa 0045 do backend): um plano de
 * 3 anos qualquer avaliado pelo motor. A conta de cada cultura é a do `/recomendacao`.
 */

/** Um ano do plano. Fora da janela de plantio, os números do motor vêm null (os fatos da terra ficam). */
export type AnoPlano = {
  cultura: CropId
  nome: string
  na_janela: boolean
  /** Anos sem aperto (deu certo); null no pousio e fora da janela. */
  anos_bons: number | null
  total_anos: number | null
  /** 2041–2060, média dos modelos (null sem o CMIP6). */
  futuro_anos_bons: number | null
  sede: Sede | null
  cobre_terra: boolean
  deixa_nitrogenio: boolean
  quebra_nematoide: boolean
  /** Mediana do que a planta usou da água no ciclo (ETr do balanço), em mm. */
  usa_mm: number | null
}

/** Notas de 0 a 100; null quando nenhum ano tem o dado (ex.: plano só com pousio, ou sem o CMIP6). */
export type NotasPlano = { seguranca: number | null; solo: number; futuro: number | null }

export type TerraPlano = {
  anos_cobertos: number
  anos_nitrogenio: number
  anos_nematoide: number
  repetidas: CropId[]
  total: number
  bonus_diversidade: number
}

export type ChuvaAproveitada = {
  /** Semeadura do motor (ISO, ano de referência). */
  inicio: string
  /** "MM-DD". */
  fim: string
  /** Mediana da chuva da semeadura ao fim de julho. */
  chuva_mm: number
  /** Média do que o plano usa por ano (pousio = 0); null se algum ano não tem o número. */
  usa_media_mm: number | null
  anos: number
  /** `rain_source` da série (ex.: `gpm_imerg`, `gpm_imerg+nasa_power`). */
  fonte: string
}

/** "Secou" = menos de `chuva_mm` mm nos `dias` dias antes de plantar; só vai para a tela com `separa`. */
export type LimiteChuva = {
  dias: number
  chuva_mm: number
  anos_marcados: number
  falhas_marcadas: number
  falhas: number
  total: number
  chance_pct: number
  separa: boolean
  motivo: 'poucas_falhas' | 'nao_separa' | null
}

export type PlanoAB = {
  cultura_a: CropId
  nome_a: string
  falhas_a: number
  total: number
  cultura_b: CropId | null
  nome_b: string | null
  b_bons_nas_falhas: number | null
  limite: LimiteChuva | null
  /** Sem Plano B: `pousio`, `nunca_falhou` ou `nenhuma_melhor`. */
  motivo: 'pousio' | 'nunca_falhou' | 'nenhuma_melhor' | null
}

export type PlanoAvaliado = {
  colheita: Colheita
  semeadura: string
  anos: AnoPlano[]
  notas: NotasPlano
  terra: TerraPlano
  chuva: ChuvaAproveitada | null
  plano_ab: PlanoAB | null
  /**
   * Sinal do outono com o Plano A e o Plano B desta tela (tarefa 0049 do backend): com o plano editado, fala
   * do Plano A que a tela mostra. Ausente (API antiga) = vale o da recomendação; null = sem sinal.
   */
  sinal?: SinalOutono | null
}

export type PlanoParams = {
  lat: number
  lon: number
  colheita: Colheita
  anos: readonly CropId[]
  solo?: Textura
}
