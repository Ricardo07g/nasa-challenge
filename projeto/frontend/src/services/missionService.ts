import type { NivelSinal, Recomendacao } from '../models/recomendacao'
import type { Ponto, Talhao, Textura } from '../models/talhao'

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
  historyYears: number | null
  signal: NivelSinal | null
}

/** O dado real que cada fase mostra. Sem o dado na API, fica null (a tela não inventa). */
export function missionFacts(talhao: Talhao, recomendacao: Recomendacao): MissionFacts {
  return {
    point: talhao.ponto,
    soil: talhao.solo?.textura ?? 'medio',
    historyYears: talhao.historico?.total ?? null,
    signal: recomendacao.sinal?.nivel ?? null,
  }
}
