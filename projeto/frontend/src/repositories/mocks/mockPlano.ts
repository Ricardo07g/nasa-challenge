/**
 * `GET /api/plano` com os dados de exemplo (VITE_API_MODE=mock, tarefa 0045). Só `repositories/index.ts`
 * importa daqui. Os números vêm das opções de exemplo (`buildRecomendacao`): ilustrativos, como o resto do
 * modo de demonstração.
 */
import type { Lang } from '../../i18n/language'
import type { AnoPlano, PlanoAvaliado, PlanoParams, PlanoSugestaoParams } from '../../models/plano'
import type { CropId, Opcao } from '../../models/recomendacao'
import type { PlanoRepository } from '../planoRepository'
import { delay } from './delay'
import { buildRecomendacao } from './fixtures'

const FALLOW_NAME: Record<Lang, string> = { pt: 'Deixar parado', en: 'Leave it fallow' }
const NEMATODE: ReadonlySet<CropId> = new Set(['crotalaria', 'milheto'])
const RAIN_MM = 413

const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)
const round1 = (value: number) => Math.round(value * 10) / 10

/** O prazo do ZARC no ano daquele ano do plano (tarefa 0065): o 1º é o da opção; os outros, um ano depois cada. */
function deadlineIn(option: Opcao | undefined, index: number): string | null {
  if (!option?.data_limite) return null
  return `${Number(option.data_limite.slice(0, 4)) + index}${option.data_limite.slice(4)}`
}

function year(crop: CropId, option: Opcao | undefined, lang: Lang, index: number): AnoPlano {
  const facts = {
    cobre_terra: crop !== 'pousio',
    deixa_nitrogenio: crop === 'crotalaria',
    quebra_nematoide: NEMATODE.has(crop),
    data_limite: deadlineIn(option, index),
    ciclo: option?.ciclo ? { dias_florescer: option.ciclo.floracao_dias, ciclo_dias: option.ciclo.dias } : null,
  }
  if (!option) {
    return {
      cultura: crop,
      nome: crop === 'pousio' ? FALLOW_NAME[lang] : crop,
      na_janela: crop === 'pousio',
      anos_bons: null,
      total_anos: null,
      futuro_anos_bons: null,
      sede: null,
      usa_mm: null,
      ...facts,
      fora_do_prazo: false,
    }
  }
  return {
    cultura: crop,
    nome: option.nome,
    na_janela: option.na_janela,
    anos_bons: option.chuva.anos_bons,
    total_anos: option.chuva.anos,
    futuro_anos_bons: option.futuro?.anos_bons_media ?? null,
    sede: option.agua?.sede ?? null,
    usa_mm: option.agua ? option.agua.precisa_mm - option.agua.falta_normal_mm : null,
    ...facts,
    fora_do_prazo: !option.na_janela,
  }
}

export function buildPlano(params: PlanoParams, lang: Lang): PlanoAvaliado {
  const rec = buildRecomendacao({ lat: params.lat, lon: params.lon, colheita: params.colheita }, lang)
  const byId = new Map(rec.opcoes.map((option) => [option.id, option]))
  const anos = params.anos.map((crop, index) => ({ ...year(crop, byId.get(crop), lang, index), fixo: true, motivo: null }))
  const options = params.anos.flatMap((crop) => byId.get(crop) ?? [])
  const distinct = new Set(params.anos.filter((crop) => crop !== 'pousio')).size
  const bonus = distinct >= 3 ? 10 : distinct === 2 ? 5 : 0
  const soil = mean(params.anos.map((crop) => byId.get(crop)?.terra.nota ?? 0)) ?? 0
  const seguranca = mean(options.map((o) => o.notas.seguranca))
  const futuro = mean(options.flatMap((o) => (o.notas.futuro === null ? [] : [o.notas.futuro])))
  const uses = anos.map((ano) => (ano.cultura === 'pousio' ? 0 : ano.usa_mm))
  const first = anos[0]
  const ids = params.anos.filter((crop) => crop !== 'pousio')
  return {
    colheita: params.colheita,
    semeadura: rec.entrada.semeadura,
    anos,
    notas: {
      seguranca: seguranca === null ? null : round1(seguranca),
      solo: round1(Math.min(100, soil + bonus)),
      futuro: futuro === null ? null : round1(futuro),
    },
    terra: {
      anos_cobertos: anos.filter((ano) => ano.cobre_terra).length,
      anos_nitrogenio: anos.filter((ano) => ano.deixa_nitrogenio).length,
      anos_nematoide: anos.filter((ano) => ano.quebra_nematoide).length,
      repetidas: [...new Set(ids.filter((crop, index) => ids.indexOf(crop) !== index))],
      total: anos.length,
      bonus_diversidade: bonus,
    },
    chuva: {
      inicio: rec.entrada.semeadura,
      fim: '07-31',
      chuva_mm: RAIN_MM,
      usa_media_mm: uses.includes(null) ? null : Math.round(mean(uses as number[]) ?? 0),
      anos: 20,
      fonte: 'gpm_imerg',
    },
    plano_ab:
      first.cultura === 'pousio'
        ? {
            cultura_a: 'pousio',
            nome_a: first.nome,
            falhas_a: 0,
            total: 0,
            cultura_b: null,
            nome_b: null,
            b_bons_nas_falhas: null,
            limite: null,
            motivo: 'pousio',
          }
        : {
            cultura_a: first.cultura,
            nome_a: first.nome,
            falhas_a: 20 - (first.anos_bons ?? 20),
            total: 20,
            cultura_b: first.cultura === 'crotalaria' ? 'milheto' : 'crotalaria',
            nome_b: byId.get(first.cultura === 'crotalaria' ? 'milheto' : 'crotalaria')?.nome ?? null,
            b_bons_nas_falhas: 4,
            limite: {
              dias: 15,
              chuva_mm: 42,
              anos_marcados: 1,
              falhas_marcadas: 0,
              falhas: 6,
              total: 20,
              chance_pct: 100,
              separa: false,
              motivo: 'nao_separa',
            },
            motivo: null,
          },
  }
}

/** O porquê de exemplo de cada ano sugerido (só no modo mock; a regra real é a do motor, a revisar pela agrônoma). */
const REASONS: Record<'fallow' | 'variety' | 'grain' | 'dry', Record<Lang, string>> = {
  fallow: {
    pt: 'a terra ficou descoberta; cobre rápido e aguenta a seca',
    en: 'the soil was left bare; it covers it fast and handles drought',
  },
  variety: { pt: 'varia a cultura e quebra o ciclo do nematoide', en: 'it varies the crop and breaks the nematode cycle' },
  grain: {
    pt: 'dá grão para vender depois de um ano cuidando da terra',
    en: 'it gives grain to sell after a year caring for the soil',
  },
  dry: { pt: 'é a que mais aguenta a seca', en: 'it handles drought best' },
}

/** Cadeia de exemplo (a do protótipo): milheto depois de terra parada ou de sorgo; sorgo depois de milheto. */
function nextCrop(previous: CropId): { crop: CropId; reason: keyof typeof REASONS } {
  if (previous === 'pousio') return { crop: 'milheto', reason: 'fallow' }
  if (previous === 'sorgo') return { crop: 'milheto', reason: 'variety' }
  if (previous === 'milheto') return { crop: 'sorgo', reason: 'grain' }
  return { crop: 'milheto', reason: 'dry' }
}

export function buildSugestao(params: PlanoSugestaoParams, lang: Lang): PlanoAvaliado {
  const crops = [...params.fixos]
  const reasons: (string | null)[] = crops.map(() => null)
  while (crops.length < 3) {
    const next = nextCrop(crops[crops.length - 1])
    crops.push(next.crop)
    reasons.push(REASONS[next.reason][lang])
  }
  const plano = buildPlano({ lat: params.lat, lon: params.lon, colheita: params.colheita, solo: params.solo, anos: crops }, lang)
  return {
    ...plano,
    anos: plano.anos.map((ano, index) => ({ ...ano, fixo: index < params.fixos.length, motivo: reasons[index] })),
  }
}

export function createMockPlanoRepository(delayMs = 300): PlanoRepository {
  return {
    async get(params, lang) {
      await delay(delayMs)
      return buildPlano(params, lang)
    },
    async suggest(params, lang) {
      await delay(delayMs)
      return buildSugestao(params, lang)
    },
  }
}
