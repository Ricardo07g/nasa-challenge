import { useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { ScreenStatus } from '../models/screenStatus'
import { apiMode as currentApiMode } from '../repositories'
import type { ApiMode } from '../repositories/repositoryMode'
import { isOutsideArea } from '../services/farmService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { pastSeasonService, readPastYear, type PastSeasonService } from '../services/pastSeasonService'
import type { TelegramService } from '../services/telegramService'
import { useAsync } from './useAsync'
import { useTelegramLink } from './useTelegramLink'

type Deps = { pastSeason: PastSeasonService; apiMode: ApiMode; telegram?: TelegramService }

const defaultDeps: Deps = { pastSeason: pastSeasonService, apiMode: currentApiMode }

/** Replay da safra passada (P4): a chuva e o calor de um ano passado e os avisos que teriam chegado. */
export function usePastSeasonController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  const year = readPastYear(search.get('ano'))
  const query = keepFlowQuery(search.toString())
  const telegramHref = useTelegramLink(deps.telegram)

  const season = useAsync(
    () =>
      params
        ? deps.pastSeason.get({ lat: params.lat, lon: params.lon }, year, lang)
        : Promise.reject(new Error('sem ponto na URL')),
    [params?.lat, params?.lon, year, lang, deps.pastSeason],
  )
  const status: ScreenStatus = season.status === 'error' && isOutsideArea(season.error) ? 'outside' : season.status

  const chooseYear = useCallback(
    (value: number) => navigate(`/safra-passada${query}${query ? '&' : '?'}ano=${value}`, { replace: true }),
    [navigate, query],
  )

  return {
    redirectTo: params ? null : '/onde',
    backTo: `/plano${query}`,
    status,
    retry: season.retry,
    year,
    chooseYear,
    season: season.status === 'ready' ? (season.data ?? null) : null,
    sampleData: deps.apiMode === 'mock',
    telegramHref,
  }
}
