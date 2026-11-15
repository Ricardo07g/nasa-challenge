import { useCallback, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { apiMode as currentApiMode } from '../repositories'
import type { ApiMode } from '../repositories/repositoryMode'
import { farmService, type FarmService } from '../services/farmService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { pastSeasonService, type PastSeasonService } from '../services/pastSeasonService'
import { rainEnd } from '../services/rainLeftService'
import { rainSummary } from '../services/satelliteService'
import { buildSuggestion, selectedYear } from '../services/suggestionService'
import type { TelegramService } from '../services/telegramService'
import { useAnswerNav } from './useAnswerNav'
import { useAsync } from './useAsync'
import { useFlowTalhao } from './useFlowRain'
import { useFlowRecomendacao } from './useFlowRecomendacao'
import { useTelegramLink } from './useTelegramLink'

type Deps = { farm: FarmService; apiMode: ApiMode; telegram?: TelegramService; pastSeason?: PastSeasonService }

const defaultDeps: Deps = { farm: farmService, apiMode: currentApiMode, pastSeason: pastSeasonService }

/** O ano aberto no explorador vem da URL (`ano`), para o link levar direto ao detalhe. */
function readYear(value: string | null): number | null {
  const year = Number(value)
  return value && Number.isInteger(year) ? year : null
}

/**
 * Aba Sugestão (seção 5.4 da remodelagem, tarefa 0044): a melhor opção do objetivo como ano 1 do plano, os 3
 * anos em miniatura, as linhas (deu certo com o explorador, água, clima 2041–2060, renda e terra), o "Como
 * fazer" e o aviso da colheita tarde. Tocar num ano abre o detalhe (a antiga tela `/safra-passada`).
 */
export function useAnswerController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const { redirectTo, recomendacao, status: flowStatus } = useFlowRecomendacao(deps.farm)
  const nav = useAnswerNav()
  const [search] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const telegramHref = useTelegramLink(deps.telegram)
  const params = useMemo(() => readFlowParams(search), [search])
  const query = keepFlowQuery(search.toString())

  const suggestion = useMemo(
    () => (recomendacao.data ? buildSuggestion(recomendacao.data, nav.objective) : null),
    [recomendacao.data, nav.objective],
  )
  const talhao = useFlowTalhao(deps.farm)
  const status = flowStatus === 'ready' && !suggestion ? 'error' : flowStatus

  const year = readYear(search.get('ano'))
  const detail = suggestion ? selectedYear(suggestion.best, year) : null
  const best = suggestion?.best.id
  const pastSeason = deps.pastSeason ?? pastSeasonService
  const timeline = useAsync(
    () =>
      params && detail && best
        ? pastSeason.get({ lat: params.lat, lon: params.lon }, detail.ano, lang, { colheita: params.colheita, opcao: best })
        : Promise.resolve(null),
    [params?.lat, params?.lon, params?.colheita, detail?.ano, best, lang, pastSeason],
  )

  const chooseYear = useCallback(
    (value: number | null) => {
      const next = value === null ? query : `${query}${query ? '&' : '?'}ano=${value}`
      navigate(`${pathname}${next}`, { replace: true })
    },
    [navigate, pathname, query],
  )

  return {
    redirectTo,
    nav,
    status,
    retry: recomendacao.retry,
    suggestion,
    colheita: recomendacao.data?.entrada.colheita ?? params?.colheita ?? null,
    aviso: recomendacao.data?.aviso ?? '',
    /** Sem o motor ligado (VITE_API_MODE=mock), os números são de exemplo. */
    sampleData: deps.apiMode === 'mock',
    planTo: `/plano${query}`,
    rain: rainSummary(talhao.data?.dados ?? [], recomendacao.data?.opcoes ?? null),
    rainEnd: rainEnd(talhao.data),
    telegramHref,
    year: {
      selected: detail,
      choose: chooseYear,
      // O detalhe dia a dia só do ano aberto (enquanto carrega o próximo, o anterior não aparece).
      timeline: timeline.data && timeline.data.ano === detail?.ano ? timeline.data : null,
      timelineStatus: detail ? timeline.status : null,
    },
  }
}
