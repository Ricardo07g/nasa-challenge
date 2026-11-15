/**
 * Repositories com os dados de exemplo (VITE_API_MODE=mock). Mesmo contrato das versões http, sem
 * backend. Só `repositories/index.ts` importa daqui (o teste mocksBoundary confere): com a API real,
 * nenhuma tela mostra estes números.
 */
import type { Lang } from '../../i18n/language'
import { EXAMPLE_FARM } from '../../models/area'
import type { TipoEvento } from '../../models/pastSeason'
import type { CommunityRepository } from '../communityRepository'
import type { CustoAtrasoRepository } from '../custoAtrasoRepository'
import type { ExemploRepository } from '../exemploRepository'
import type { PastSeasonRepository } from '../pastSeasonRepository'
import type { RecomendacaoRepository } from '../recomendacaoRepository'
import type { RegionRepository } from '../regionRepository'
import type { TalhaoRepository } from '../talhaoRepository'
import { delay } from './delay'
import { buildCommunity, buildCustoAtraso, buildRecomendacao, buildTalhao } from './fixtures'

/** Talhão com dados de exemplo. */
export function createMockTalhaoRepository(delayMs = 500): TalhaoRepository {
  return {
    async get(point, lang) {
      await delay(delayMs)
      return buildTalhao(point, lang)
    },
  }
}

export function createMockRecomendacaoRepository(delayMs = 400): RecomendacaoRepository {
  return {
    async get(params, lang) {
      await delay(delayMs)
      return buildRecomendacao(params, lang)
    },
  }
}

export function createMockExemploRepository(delayMs = 0): ExemploRepository {
  return {
    async get(lang) {
      await delay(delayMs)
      return {
        talhao: buildTalhao(EXAMPLE_FARM, lang),
        recomendacao: buildRecomendacao({ ...EXAMPLE_FARM, colheita: 'meio' }, lang),
      }
    },
  }
}

/** Custo do atraso (tela 3): a melhor opção de cada faixa, com números de exemplo. */
export function createMockCustoAtrasoRepository(delayMs = 400): CustoAtrasoRepository {
  return {
    async get(params, lang) {
      await delay(delayMs)
      return buildCustoAtraso(params, lang)
    },
  }
}

/** Tela 8 simulada (PRD RF-13 a RF-15): vizinhos e pluviômetros ilustrativos. */
export function createMockCommunityRepository(delayMs = 300): CommunityRepository {
  return {
    async get(lang) {
      await delay(delayMs)
      return buildCommunity(lang)
    },
  }
}

/** % parado de 2015 a 2025 (dados de exemplo, na ordem de grandeza da região). */
const IDLE: [number, number][] = [
  [2015, 70],
  [2016, 69],
  [2017, 67],
  [2018, 68],
  [2019, 66],
  [2020, 65],
  [2021, 63],
  [2022, 61],
  [2023, 64],
  [2024, 63],
  [2025, 62],
]

export function createMockRegionRepository(delayMs = 300): RegionRepository {
  return {
    async get(point) {
      await delay(delayMs)
      return {
        raio_km: 30,
        fonte: 'modis_mod13q1',
        // O círculo de exemplo é sempre em volta do ponto pedido.
        centro: { lat: point.lat, lon: point.lon },
        distancia_km: 0,
        anos: IDLE.map(([ano, parado]) => ({ ano, pct_parado: parado, pct_incerto: 9, pct_plantou: 100 - parado - 9 })),
      }
    },
  }
}

type Event = { data: string; tipo: TipoEvento; texto: Record<Lang, string> }

/** Dados de exemplo: 2024 foi seco (com avisos); 2023 foi bom (sem avisos). */
const EVENTS: Record<number, Event[]> = {
  2024: [
    { data: '2024-02-18', tipo: 'semeadura', texto: { pt: 'Semeadura do milho com braquiária.', en: 'Sowing corn with brachiaria.' } },
    { data: '2024-04-06', tipo: 'sem_chuva', texto: { pt: 'Parou de chover.', en: 'Rain stopped.' } },
    {
      data: '2024-04-15',
      tipo: 'aviso_veranico',
      texto: {
        pt: 'Aviso: 10 dias sem chuva perto da fase que mais precisa de água. Converse com o agrônomo.',
        en: 'Warning: 10 days without rain close to the stage that needs water most. Talk to your agronomist.',
      },
    },
    { data: '2024-04-18', tipo: 'fase_critica', texto: { pt: 'Fase que mais precisa de água.', en: 'Stage that needs water most.' } },
    {
      data: '2024-04-20',
      tipo: 'voltou_chuva',
      texto: { pt: 'Voltou a chover (14 dias sem chuva no total).', en: 'Rain returned (14 days without rain in total).' },
    },
    { data: '2024-04-24', tipo: 'aviso_calor', texto: { pt: 'Aviso: 2 dias seguidos acima de 35 °C.', en: 'Warning: 2 days in a row above 35 °C.' } },
    {
      data: '2024-06-20',
      tipo: 'colheita',
      texto: { pt: 'Colheita do milho. O capim segue cobrindo a terra.', en: 'Corn harvest. The grass keeps covering the soil.' },
    },
  ],
  2023: [
    { data: '2023-02-18', tipo: 'semeadura', texto: { pt: 'Semeadura.', en: 'Sowing.' } },
    {
      data: '2023-04-20',
      tipo: 'fase_critica',
      texto: { pt: 'Fase que mais precisa de água. Choveu o bastante.', en: 'Stage that needs water most. Enough rain.' },
    },
    { data: '2023-06-20', tipo: 'colheita', texto: { pt: 'Colheita.', en: 'Harvest.' } },
  ],
}

export function createMockPastSeasonRepository(delayMs = 300): PastSeasonRepository {
  return {
    async get(_point, year, lang) {
      await delay(delayMs)
      const events = EVENTS[year] ?? EVENTS[2024]
      return {
        ano: year,
        opcao: 'milho_braquiaria',
        eventos: events.map((event) => ({ data: event.data, tipo: event.tipo, texto: event.texto[lang] })),
      }
    },
  }
}
