import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { useI18n } from '../i18n/useI18n'
import type { Opcao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import type { FarmService } from '../services/farmService'
import { readFlowParams } from '../services/flowParams'
import { rainSummary, type RainSummary } from '../services/satelliteService'
import { useAsync, type AsyncState } from './useAsync'

/**
 * O talhão do caminho que está na URL (telas 5 a 7). Quase sempre já está no cache; se falhar, a tela segue
 * sem os blocos que dependem dele.
 */
export function useFlowTalhao(farm: FarmService): AsyncState<Talhao> {
  const { lang } = useI18n()
  const [search] = useSearchParams()
  const params = useMemo(() => readFlowParams(search), [search])
  return useAsync(
    () =>
      params
        ? farm.talhao({ lat: params.lat, lon: params.lon, exemplo: params.exemplo }, lang)
        : Promise.reject(new Error('sem ponto na URL')),
    [params?.lat, params?.lon, params?.exemplo, lang, farm],
  )
}

/**
 * Anos e período da chuva do caminho que está na URL (telas 5 e 6), para a legenda dos quadrinhos sem
 * ano fixo: o período vem do talhão (`dados[]`), os anos das opções. O talhão quase sempre já está no
 * cache; se falhar, a tela segue só com o número de anos.
 */
export function useFlowRain(farm: FarmService, opcoes: readonly Opcao[] | null): RainSummary | null {
  const talhao = useFlowTalhao(farm)
  return rainSummary(talhao.data?.dados ?? [], opcoes)
}
