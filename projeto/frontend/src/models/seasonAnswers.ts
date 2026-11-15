import type { CropId } from './recomendacao'

/**
 * Respostas das últimas safras (pacote 2, tarefa 0054): o contrato que as telas 4 (raio-X) e 5 (Escolher e
 * Plano de 3 anos) usam. O ano é o da **colheita da soja** (2026 = safra 2025/26).
 *
 * Numa safra passada, a resposta é uma só:
 * - um id de cultura do `culturas.yaml` (com `pousio` = "Deixei parado"): plantou a soja e, depois dela, isso;
 * - `soja`: plantou a soja e não disse o que veio depois;
 * - `sem_soja`: não plantou a soja nessa safra.
 *
 * Sem resposta, o ano fica de fora (indefinido): o produtor segue normalmente (regra geral 6).
 */
export type SeasonAnswer = CropId | 'soja' | 'sem_soja'

export type SeasonAnswers = Readonly<Partial<Record<number, SeasonAnswer>>>

/** O que o produtor pensa plantar depois da soja da safra atual (2026/27): a "escolha atual" da tela 5. */
export type CurrentChoice = CropId | 'nao_sei'

/** O que o satélite viu numa safra passada, para pré-marcar "Plantei" e escrever a dica ao lado do ano. */
export type SeasonSatellite = {
  /** Viu a soja no verão (pré-marca "Plantei"). */
  soy: boolean
  /** O que viu depois da soja; null = sem certeza ou sem soja. */
  after: 'plantou' | 'parado' | null
  /** Maior verde (NDVI, MODIS) depois da colheita; null sem leitura boa. */
  ndvi: number | null
}

/** Uma linha do formulário "Confirme as últimas safras": a safra e o que o satélite viu (null = sem leitura). */
export type SeasonRow = { year: number; satellite: SeasonSatellite | null }
