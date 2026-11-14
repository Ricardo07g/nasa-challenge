import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { farmService, type FarmService } from '../services/farmService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { EXAMPLE_FARM } from '../services/locationService'
import { scoreRows } from '../services/recomendacaoRules'
import type { TelegramService } from '../services/telegramService'
import { useAsync } from './useAsync'
import { useTelegramLink } from './useTelegramLink'

type Deps = { farm: FarmService; telegram?: TelegramService }

const defaultDeps: Deps = { farm: farmService }

/**
 * Tela 9 "Como a conta é feita" (para agrônomos e jurados): o método e a tabela de notas de 0 a 100.
 * Com o caminho na URL, as notas são da lavoura da pessoa; sem ele, da fazenda de exemplo (RF-11).
 */
export function useMethodController(deps: Deps = defaultDeps) {
  const { lang } = useI18n()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  const example = !params?.colheita
  const telegramHref = useTelegramLink(deps.telegram)

  const recomendacao = useAsync(
    () =>
      params?.colheita
        ? deps.farm.recomendacao(
            { lat: params.lat, lon: params.lon, colheita: params.colheita, solo: params.solo, exemplo: params.exemplo },
            lang,
          )
        : deps.farm.recomendacao({ ...EXAMPLE_FARM, colheita: 'meio', exemplo: true }, lang),
    [params?.lat, params?.lon, params?.colheita, params?.solo, params?.exemplo, lang, deps.farm],
  )

  return {
    backTo: example ? '/' : `/resposta${keepFlowQuery(search.toString())}`,
    status: recomendacao.status,
    retry: recomendacao.retry,
    rows: recomendacao.data ? scoreRows(recomendacao.data) : [],
    example,
    telegramHref,
  }
}
