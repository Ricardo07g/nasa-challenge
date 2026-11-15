/**
 * "Na sua lavoura" do Guia (tela 8 do pacote 3): a caixa azul com um número real do ponto marcado, quando o
 * artigo tem um dado ligado a ele. O número vem pronto do `GET /api/raio-x` (as contas são do backend); aqui
 * só qual dado vale para cada artigo e de quem é a lavoura (o ponto da URL ou o salvo no aparelho, o mesmo
 * dos avisos, nunca a fazenda de exemplo). Sem ponto ou sem dado, a caixa não aparece.
 *
 * Regra do usuário de 15/11/2026: na caixa, só o número do ponto que vem da API, com a fonte do dado, e nenhuma
 * hipótese do time. Por isso ficam de fora a geada (limite de 3 °C), o fogo (raio de 5 km), a água que a terra
 * guarda (tabela de CAD por textura) e o fim das chuvas (a regra dos 20 dias com menos de 10 mm).
 */
import type { GuideSlug } from '../content/guia/slugs'
import type { Lang } from '../i18n/language'
import type { PontoAvisos } from '../models/avisos'
import type {
  AlertaChuvaForte,
  CalorOutono,
  ChuvaTipica,
  ClimaFuturo,
  RaioX,
  RaioXParams,
  SoloRaioX,
  UmidadeAgora,
  Veranico,
} from '../models/raioX'
import { savedPointRepository as defaultSaved } from '../repositories'
import type { SavedPointRepository } from '../repositories/savedPointRepository'
import { alertsPoint, pointFromFlow } from './avisosService'
import type { FlowParams } from './flowParams'
import { raioXService, type RaioXService } from './raioXService'

export type FieldFact =
  | { kind: 'heavyRain'; data: AlertaChuvaForte }
  | { kind: 'dryspell'; data: Veranico }
  | { kind: 'heat'; data: CalorOutono }
  | { kind: 'future'; data: ClimaFuturo }
  | { kind: 'xray'; soil: SoloRaioX | null; moisture: UmidadeAgora | null; rain: ChuvaTipica | null }

/** O dado de cada artigo (só os que têm um número do ponto). Sem o dado no raio-X: `null`, sem caixa. */
const FIELD_DATA: Partial<Record<GuideSlug, (raio: RaioX) => FieldFact | null>> = {
  'como-evitar-erosao': (r) => (r.alertas.chuva_forte ? { kind: 'heavyRain', data: r.alertas.chuva_forte } : null),
  veranico: (r) => (r.veranico ? { kind: 'dryspell', data: r.veranico } : null),
  'calor-35-graus': (r) => (r.calor ? { kind: 'heat', data: r.calor } : null),
  'clima-2041-2060': (r) => (r.cartoes.clima_futuro ? { kind: 'future', data: r.cartoes.clima_futuro } : null),
  'raio-x': (r) => (r.solo || r.umidade || r.chuva ? { kind: 'xray', soil: r.solo, moisture: r.umidade, rain: r.chuva } : null),
}

/** Os artigos com um número do ponto (só eles pedem o raio-X). */
export const FIELD_SLUGS = Object.keys(FIELD_DATA) as GuideSlug[]

export function hasFieldData(slug: string): boolean {
  return slug in FIELD_DATA
}

export function fieldFact(slug: string, raio: RaioX | null | undefined): FieldFact | null {
  const pick = FIELD_DATA[slug as GuideSlug]
  return pick && raio ? pick(raio) : null
}

/** A lavoura do produtor: o ponto da URL (fora a fazenda de exemplo) ou, sem ele, o salvo no aparelho. */
export function fieldPoint(flow: (FlowParams & { exemplo: boolean }) | null, saved: PontoAvisos | null): PontoAvisos | null {
  return alertsPoint(pointFromFlow(flow), saved)
}

/** O pedido do raio-X com a colheita e a terra do ponto; sem colheita, a do meio (o padrão do backend). */
export function fieldRequest(point: PontoAvisos): RaioXParams {
  const params: RaioXParams = { lat: point.lat, lon: point.lon, colheita: point.colheita ?? 'meio' }
  if (point.solo) params.solo = point.solo
  return params
}

export function createGuideFieldService(raioX: RaioXService = raioXService, saved: SavedPointRepository = defaultSaved) {
  return {
    savedPoint: (): PontoAvisos | null => saved.get(),
    /** O dado do artigo no ponto; artigo sem dado ligado ou sem ponto não pede nada. */
    fact(slug: string, point: PontoAvisos | null, lang: Lang): Promise<FieldFact | null> {
      if (!point || !hasFieldData(slug)) return Promise.resolve(null)
      return raioX.get(fieldRequest(point), lang).then((raio) => fieldFact(slug, raio))
    },
  }
}

export type GuideFieldService = ReturnType<typeof createGuideFieldService>
export const guideFieldService = createGuideFieldService()
