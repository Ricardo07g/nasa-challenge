import type { NivelSinal, Recomendacao } from '../models/recomendacao'
import type { Ponto, Talhao, Textura } from '../models/talhao'
import { historySummary, rainSummary } from './satelliteService'

/** RF-19: a missão tem 6 fases (lavoura, terra, chuva e calor, histórico, clima que vem, conta). */
export const MISSION_PHASES = 6

/** Cada fase dura no mínimo 1,2 s, mesmo com os dados já prontos. */
export const PHASE_MIN_MS = 1200

/** Depois de 20 s sem terminar, a tela oferece a fazenda de exemplo. */
export const WEAK_SIGNAL_MS = 20000

/** Com a missão completa, segue sozinha para a tela 4 depois deste tempo. */
export const FINISH_DELAY_MS = 3000

/** Quanto falta para a fase atual poder terminar. */
export function phaseWait(elapsedMs: number): number {
  return Math.max(0, PHASE_MIN_MS - elapsedMs)
}

export type MissionFacts = {
  point: Ponto
  soil: Textura
  /** Anos de chuva que a conta leu (null sem dado de chuva). */
  rainYears: number | null
  historyYears: number | null
  signal: NivelSinal | null
}

/**
 * O dado real que cada fase mostra. Sem o dado na API, fica null (a tela não inventa). Os anos de
 * histórico contam só os anos certos, como a frase da tela 4.
 */
export function missionFacts(talhao: Talhao, recomendacao: Recomendacao): MissionFacts {
  return {
    point: talhao.ponto,
    soil: talhao.solo?.textura ?? recomendacao.entrada?.solo ?? 'medio',
    rainYears: rainSummary(talhao.dados ?? [], recomendacao.opcoes ?? null)?.years ?? null,
    historyYears: historySummary(talhao.historico)?.known ?? null,
    signal: recomendacao.sinal?.nivel ?? null,
  }
}
