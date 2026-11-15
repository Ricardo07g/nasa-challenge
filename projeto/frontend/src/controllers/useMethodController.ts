import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import { farmService, type FarmService } from '../services/farmService'
import { keepFlowQuery, readFlowParams } from '../services/flowParams'
import { EXAMPLE_FARM } from '../services/locationService'
import { scoreRows } from '../services/recomendacaoRules'
import { rainSummary } from '../services/satelliteService'
import { rainResolutionKm, sourceStatuses } from '../services/sourceService'
import type { TelegramService } from '../services/telegramService'
import { useAsync } from './useAsync'
import type { MetodoRegras } from '../models/metodo'
import { metodoRepository } from '../repositories'
import type { MetodoRepository } from '../repositories/metodoRepository'
import { useTelegramLink } from './useTelegramLink'
import { formatNumber } from '../i18n/format'
import { speechService, type SpeechService } from '../services/speechService'
import { useListenSummary } from './useListenSummary'

type Deps = { farm: FarmService; method?: MetodoRepository; telegram?: TelegramService; speech?: SpeechService }

const defaultDeps: Deps = { farm: farmService, method: metodoRepository }

/**
 * Tela 9 "Como a conta é feita" (para agrônomos e jurados): o método, as fontes (quais estão
 * conectadas de fato, pelo talhão) e a tabela de notas de 0 a 100. Com o caminho na URL, tudo é da
 * lavoura da pessoa; sem ele, da fazenda de exemplo (RF-11).
 */
export function useMethodController(deps: Deps = defaultDeps) {
  const { lang, messages: t } = useI18n()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  const example = !params?.colheita
  const telegramHref = useTelegramLink(deps.telegram)

  const recomendacao = useAsync(
    () =>
      params?.colheita
        ? deps.farm.recomendacao(
            {
              lat: params.lat,
              lon: params.lon,
              colheita: params.colheita,
              solo: params.solo,
              exemplo: params.exemplo,
              confirmadas: params.confirmadas,
            },
            lang,
          )
        : deps.farm.recomendacao({ ...EXAMPLE_FARM, colheita: 'meio', exemplo: true }, lang),
    [params?.lat, params?.lon, params?.colheita, params?.solo, params?.exemplo, params?.confirmadas, lang, deps.farm],
  )
  const talhao = useAsync(
    () =>
      params?.colheita
        ? deps.farm.talhao({ lat: params.lat, lon: params.lon, exemplo: params.exemplo }, lang)
        : deps.farm.talhao({ ...EXAMPLE_FARM, exemplo: true }, lang),
    [params?.lat, params?.lon, params?.colheita, params?.exemplo, lang, deps.farm],
  )

  // Tarefa 0049: os números das regras vêm do regras.yaml (`GET /api/metodo`). Sem a rota (API antiga) ou
  // com falha, o bloco das regras não aparece (o resto da tela continua).
  const method = deps.method ?? metodoRepository
  const rulesAsync = useAsync((): Promise<MetodoRegras | null> => method.get().catch(() => null), [method])

  const sources = talhao.data
    ? { status: talhao.status, rows: sourceStatuses(talhao.data), rainKm: rainResolutionKm(talhao.data) }
    : { status: talhao.status, rows: [], rainKm: null }

  const rain = talhao.data ? rainSummary(talhao.data.dados, recomendacao.data?.opcoes ?? null) : null
  const rules = rulesAsync.data ?? null

  // "Ouvir resumo" (regra geral 9 do pacote 2): os anos de chuva, os pesos da nota (do regras.yaml) e o "sem IA".
  const n = (value: number) => formatNumber(lang, value)
  const p = rules?.pesos
  const listen = useListenSummary(
    [
      t.method.summaryRain(rain?.years ?? null),
      p ? t.method.summaryWeights(n(p.seguranca_pct), n(p.futuro_pct), n(p.solo_pct), n(p.renda_pct)) : null,
      t.method.summaryEnd,
    ]
      .filter(Boolean)
      .join(' '),
    lang,
    deps.speech ?? speechService,
  )

  return {
    backTo: example ? '/' : `/resposta${keepFlowQuery(search.toString())}`,
    status: recomendacao.status,
    retry: recomendacao.retry,
    rows: recomendacao.data ? scoreRows(recomendacao.data) : [],
    example,
    telegramHref,
    sources,
    retrySources: talhao.retry,
    rain,
    rules,
    listen,
  }
}
