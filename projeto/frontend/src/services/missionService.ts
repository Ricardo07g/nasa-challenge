import type { NivelSinal, Recomendacao } from '../models/recomendacao'
import type { Ponto, Talhao, Textura } from '../models/talhao'
import { type ClimateSummary, climateSummary, historySummary, rainSummary } from './satelliteService'

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
  /** "SoilGrids" quando a terra veio do mapa de solos; null no padrão (sem mapa). */
  soilSource: string | null
  /** Anos do SMAP usados no balde do dia de plantar (tarefa 0049); null sem SMAP na célula. */
  smap: { start: string; end: string } | null
  /** Anos de chuva que a conta leu (null sem dado de chuva). */
  rainYears: number | null
  /** De onde veio a chuva da série: "GPM IMERG" ou "NASA POWER" (o calor é sempre do NASA POWER). */
  rainSource: string | null
  historyYears: number | null
  /** Clima de 2041–2060 (NEX-GDDP-CMIP6 no talhão); null quando a API não traz. */
  future: ClimateSummary | null
  /** Previsão do outono (sinal); é outro dado, separado do clima do futuro. */
  signal: NivelSinal | null
  /** Quem publicou a previsão do ENSO (a 1ª fonte do sinal, ex.: "NOAA"). */
  signalSource: string | null
  /** Opções que entram na conta: as que cabem na janela de plantio e deixar parado; null sem a conta. */
  options: number | null
}

const SOURCE_NAMES: Record<string, string> = { gpm_imerg: 'GPM IMERG', nasa_power: 'NASA POWER' }

function yearSpan(periodo: string | undefined): { start: string; end: string } | null {
  const match = periodo?.match(/^(\d{4})-(\d{4})$/)
  return match ? { start: match[1], end: match[2] } : null
}

/**
 * O dado real que cada fase mostra. Sem o dado na API, fica null (a tela não inventa). Os anos de
 * histórico contam só os anos certos, como a frase da tela 4.
 */
export function missionFacts(talhao: Talhao, recomendacao: Recomendacao): MissionFacts {
  const dados = talhao.dados ?? []
  const has = (fonte: string) => dados.some((dado) => dado.fonte === fonte)
  const rainKey = has('gpm_imerg') ? 'gpm_imerg' : has('nasa_power') ? 'nasa_power' : null
  const inWindow = recomendacao.opcoes?.filter((opcao) => opcao.na_janela).length
  return {
    point: talhao.ponto,
    soil: talhao.solo?.textura ?? recomendacao.entrada?.solo ?? 'medio',
    soilSource: talhao.solo?.fonte === 'soilgrids' ? 'SoilGrids' : null,
    smap: yearSpan(dados.find((dado) => dado.fonte === 'smap')?.periodo),
    rainYears: rainSummary(dados, recomendacao.opcoes ?? null)?.years ?? null,
    rainSource: rainKey ? SOURCE_NAMES[rainKey] : null,
    historyYears: historySummary(talhao.historico)?.known ?? null,
    future: climateSummary(dados),
    signal: recomendacao.sinal?.nivel ?? null,
    signalSource: recomendacao.sinal?.fonte?.[0] ?? null,
    // Deixar parado também entra na conta (PRD 7.2), mas não está em `opcoes`.
    options: inWindow === undefined ? null : inWindow + 1,
  }
}
