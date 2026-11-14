import type { Lang } from '../i18n/language'
import type { Recomendacao, RecomendacaoParams } from '../models/recomendacao'
import type { Ponto, Talhao } from '../models/talhao'
import {
  exemploRepository as defaultExemplo,
  recomendacaoRepository as defaultRecomendacao,
  talhaoRepository as defaultTalhao,
} from '../repositories'
import type { ExemploRepository } from '../repositories/exemploRepository'
import type { RecomendacaoRepository } from '../repositories/recomendacaoRepository'
import type { TalhaoRepository } from '../repositories/talhaoRepository'

type Deps = {
  talhaoRepository: TalhaoRepository
  recomendacaoRepository: RecomendacaoRepository
  exemploRepository: ExemploRepository
}

export type FarmService = {
  talhao(point: Ponto & { exemplo?: boolean }, lang: Lang): Promise<Talhao>
  recomendacao(params: RecomendacaoParams & { exemplo?: boolean }, lang: Lang): Promise<Recomendacao>
}

/**
 * Dados da lavoura para as telas 2 a 7, com cache em memória: a busca do talhão disparada na tela 2
 * ("É aqui") já está pronta quando a pessoa chega nas telas 3 e 4 (plano técnico §2).
 * Na fazenda de exemplo, tudo vem de /exemplo (RF-11: abre na hora).
 */
export function createFarmService({
  talhaoRepository,
  recomendacaoRepository,
  exemploRepository,
}: Deps): FarmService {
  const cache = new Map<string, Promise<unknown>>()

  function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = cache.get(key) as Promise<T> | undefined
    if (hit) return hit
    const promise = load().catch((error: unknown) => {
      cache.delete(key)
      throw error
    })
    cache.set(key, promise)
    return promise
  }

  const exemplo = (lang: Lang) => cached(`exemplo:${lang}`, () => exemploRepository.get(lang))

  return {
    talhao(point, lang) {
      if (point.exemplo) return exemplo(lang).then((data) => data.talhao)
      return cached(`talhao:${point.lat},${point.lon}:${lang}`, () =>
        talhaoRepository.get({ lat: point.lat, lon: point.lon }, lang),
      )
    },
    recomendacao(params, lang) {
      if (params.exemplo) return exemplo(lang).then((data) => data.recomendacao)
      const { lat, lon, colheita, solo } = params
      return cached(`recomendacao:${lat},${lon},${colheita},${solo ?? ''}:${lang}`, () =>
        recomendacaoRepository.get({ lat, lon, colheita, solo }, lang),
      )
    },
  }
}

export const farmService = createFarmService({
  talhaoRepository: defaultTalhao,
  recomendacaoRepository: defaultRecomendacao,
  exemploRepository: defaultExemplo,
})

/** O servidor ainda não tem dados para esse ponto (404 OUTSIDE_AREA). */
export { isOutsideArea } from '../repositories/httpClient'
