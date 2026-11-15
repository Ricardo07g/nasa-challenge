import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { farmService, type FarmService } from '../services/farmService'
import { nearestPlace } from '../services/locationService'
import {
  FINISH_DELAY_MS,
  MISSION_PHASES,
  WEAK_SIGNAL_MS,
  missionFacts,
  phaseWait,
} from '../services/missionService'
import { useI18n } from '../i18n/useI18n'
import { speechService, type SpeechService } from '../services/speechService'
import { useFlowFarm } from './useFlowFarm'
import { useListenSummary } from './useListenSummary'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

type Deps = { farm: FarmService; speech?: SpeechService }

const defaultDeps: Deps = { farm: farmService }

/**
 * Tela de cálculo "Missão: sua lavoura" (RF-19), entre a pergunta 2 e a tela 4. Busca o talhão e a
 * recomendação (quase sempre já no cache), passa pelas 6 fases (mínimo de 1,2 s cada) e segue sozinha.
 */
export function useMissionController(deps: Deps = defaultDeps) {
  const { lang, messages: t } = useI18n()
  const navigate = useNavigate()
  const reducedMotion = usePrefersReducedMotion()
  const { params, query, redirectTo, talhao, recomendacao, status } = useFlowFarm(deps.farm)

  // Fases: só avançam com os dados prontos, e cada uma dura no mínimo 1,2 s.
  const [phase, setPhase] = useState(0)
  const phaseStarted = useRef(Date.now())
  useEffect(() => {
    phaseStarted.current = Date.now()
  }, [phase])
  useEffect(() => {
    if (status !== 'ready' || phase >= MISSION_PHASES) return
    const timer = setTimeout(() => setPhase((current) => current + 1), phaseWait(Date.now() - phaseStarted.current))
    return () => clearTimeout(timer)
  }, [status, phase])
  const complete = phase >= MISSION_PHASES

  // Depois de 20 s sem terminar: "o sinal está fraco" (com a fazenda de exemplo).
  const [attempt, setAttempt] = useState(0)
  const [weak, setWeak] = useState(false)
  useEffect(() => {
    if (complete || status === 'error' || status === 'outside') return
    const timer = setTimeout(() => setWeak(true), WEAK_SIGNAL_MS)
    return () => clearTimeout(timer)
  }, [attempt, complete, status])

  // Missão completa: segue sozinha para a tela 4.
  useEffect(() => {
    if (!complete) return
    const timer = setTimeout(() => navigate(`/satelite${query}`, { replace: true }), FINISH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [complete, navigate, query])

  const waitMore = useCallback(() => {
    setWeak(false)
    setAttempt((value) => value + 1)
  }, [])

  const { retry: retryTalhao } = talhao
  const { retry: retryRecomendacao } = recomendacao
  const retry = useCallback(() => {
    retryTalhao()
    retryRecomendacao()
    setWeak(false)
    setAttempt((value) => value + 1)
  }, [retryTalhao, retryRecomendacao])

  const [spins, setSpins] = useState(0)
  const spin = useCallback(() => setSpins((value) => value + 1), [])

  const facts = status === 'ready' && talhao.data && recomendacao.data ? missionFacts(talhao.data, recomendacao.data) : null
  const place = params ? nearestPlace(params) : null
  // "Ouvir resumo" (regra geral 9 do pacote 2): o lugar e os anos de chuva lidos; não muda a cada fase,
  // para a fala não parar no meio.
  const listen = useListenSummary(t.mission.summary(place, facts?.rainYears ?? null), lang, deps.speech ?? speechService)

  return {
    redirectTo,
    backTo: `/quando${query}`,
    continueTo: `/satelite${query}`,
    status,
    phase,
    complete,
    facts,
    place,
    weak: weak && !complete,
    waitMore,
    retry,
    spins,
    spin,
    reducedMotion,
    listen,
  }
}
