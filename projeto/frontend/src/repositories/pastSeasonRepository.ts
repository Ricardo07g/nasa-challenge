import type { Lang } from '../i18n/language'
import type { SafraPassada, TipoEvento } from '../models/pastSeason'
import type { Ponto } from '../models/talhao'
import { getJson as defaultGetJson, type GetJson } from './httpClient'
import { delay } from './mocks/delay'

export type PastSeasonRepository = {
  get(point: Ponto, year: number, lang: Lang): Promise<SafraPassada>
}

/** `GET /api/safra-passada?lat&lon&ano` (P4, contrato proposto; o backend ainda não tem). */
export function createHttpPastSeasonRepository(getJson: GetJson = defaultGetJson): PastSeasonRepository {
  return {
    get: (point, year, lang) =>
      getJson<SafraPassada>(`/api/safra-passada?lat=${point.lat}&lon=${point.lon}&ano=${year}`, { lang }),
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
