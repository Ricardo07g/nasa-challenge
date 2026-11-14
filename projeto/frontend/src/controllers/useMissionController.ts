import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { ScreenStatus } from '../models/screenStatus'
import { farmService, isOutsideArea, type FarmService } from '../services/farmService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { nearestPlace } from '../services/locationService'
import {
  FINISH_DELAY_MS,
  MISSION_PHASES,
  WEAK_SIGNAL_MS,
  missionFacts,
  phaseWait,
} from '../services/missionService'
import { useAsync } from './useAsync'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

type Deps = { farm: FarmService }

const defaultDeps: Deps = { farm: farmService }

/**
 * Tela de cálculo "Missão: sua lavoura" (RF-19), entre a pergunta 2 e a tela 4. Busca o talhão e a
 * recomendação (quase sempre já no cache), passa pelas 6 fases (mínimo de 1,2 s cada) e segue sozinha.
 */
export function useMissionController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  const query = keepFlowQuery(search.toString())
  const reducedMotion = usePrefersReducedMotion()

  const talhao = useAsync(
    () =>
      params
        ? deps.farm.talhao({ lat: params.lat, lon: params.lon, exemplo: params.exemplo }, lang)
        : Promise.reject(new Error('sem ponto na URL')),
    [params?.lat, params?.lon, params?.exemplo, lang, deps.farm],
  )
  const recomendacao = useAsync(
    () =>
      params?.colheita
        ? deps.farm.recomendacao(
            { lat: params.lat, lon: params.lon, colheita: params.colheita, solo: params.solo, exemplo: params.exemplo },
            lang,
          )
        : Promise.reject(new Error('sem colheita na URL')),
    [params?.lat, params?.lon, params?.colheita, params?.solo, params?.exemplo, lang, deps.farm],
  )

  const outside =
    (talhao.status === 'ready' && talhao.data?.dentro_da_area === false) ||
    isOutsideArea(talhao.error) ||
    isOutsideArea(recomendacao.error)
  const status: ScreenStatus = outside
    ? 'outside'
    : talhao.status === 'error' || recomendacao.status === 'error'
      ? 'error'
      : talhao.status === 'ready' && recomendacao.status === 'ready'
        ? 'ready'
        : 'loading'

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

  return {
    redirectTo: !params ? '/onde' : !params.colheita ? `/quando${query}` : null,
    backTo: `/quando${query}`,
    continueTo: `/satelite${query}`,
    status,
    phase,
    complete,
    facts,
    place: params ? nearestPlace(params) : null,
    weak: weak && !complete,
    waitMore,
    retry,
    spins,
    spin,
    reducedMotion,
  }
}
