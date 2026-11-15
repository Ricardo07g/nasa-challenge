/**
 * Avisos de demonstração (só com VITE_API_MODE=mock, desligado por padrão; a tela mostra o aviso fixo
 * "Modo de demonstração"). Os números imitam o formato de `GET /api/avisos` e não são da NASA.
 */
import type { Lang } from '../../i18n/language'
import type { Avisos, PontoAvisos } from '../../models/avisos'
import type { AvisosRepository } from '../avisosRepository'
import { delay } from './delay'

const SERIES_END = '2024-07-30'

export function buildAvisos(point: PontoAvisos, lang: Lang): Avisos {
  const crop = lang === 'en' ? 'Corn with brachiaria' : 'Milho com braquiária'
  return {
    ponto: { lat: point.lat, lon: point.lon },
    celula_id: '-190_-482',
    hoje: '2026-11-15',
    contador: 2,
    agora: {
      avisos: [
        {
          tipo: 'enso',
          nivel: 'fique_de_olho',
          fontes: ['noaa', 'gpm_imerg'],
          data: '2026-11-12',
          antiga: false,
          valores: {
            fase: 'el_nino',
            chance_pct: 98,
            estacao: 'FMA',
            ano: 2027,
            cultura: 'milho_braquiaria',
            nome: crop,
            anos_fase: 7,
            bons_fase: 5,
            anos_outros: 13,
            bons_outros: 11,
            ano_inicio: 2005,
            ano_fim: 2024,
          },
        },
      ],
      ultima_leitura: '2026-11-12',
    },
    mudou: {
      avisos: [
        {
          tipo: 'mudou_veranico',
          nivel: 'fique_de_olho',
          fontes: ['gpm_imerg'],
          data: SERIES_END,
          antiga: false,
          valores: { antes: 20.8, recente: 27.2 },
        },
        {
          tipo: 'mudou_deu_certo',
          nivel: 'fique_de_olho',
          fontes: ['gpm_imerg', 'nasa_power'],
          data: SERIES_END,
          antiga: false,
          valores: {
            antes_bons: 13,
            antes_total: 15,
            recente_bons: 3,
            recente_total: 5,
            cultura: 'milho_braquiaria',
            nome: crop,
          },
        },
      ],
      ultima_leitura: SERIES_END,
    },
    periodo: { recente_inicio: 2020, recente_fim: 2024, antes_inicio: 2005, antes_fim: 2019 },
    recordes: {
      avisos: [
        {
          tipo: 'recorde_veranico',
          nivel: 'fique_de_olho',
          fontes: ['gpm_imerg'],
          data: SERIES_END,
          antiga: false,
          valores: { dias: 43, ano: 2024, inicio: '04-19' },
        },
        {
          tipo: 'recorde_outono_seco',
          nivel: 'fique_de_olho',
          fontes: ['gpm_imerg'],
          data: SERIES_END,
          antiga: false,
          valores: { chuva_mm: 178, ano: 2021, media_mm: 330.7 },
        },
      ],
      ultima_leitura: SERIES_END,
    },
    perto: {
      avisos: [
        {
          tipo: 'vizinho_evento',
          nivel: 'fique_de_olho',
          fontes: ['comunidade'],
          data: '2026-11-14',
          antiga: false,
          valores: { evento: 'geada', relatos: 1 },
        },
      ],
      ultima_leitura: '2026-11-15',
    },
    raio_km: 30,
    vizinhos_dias: 7,
    safrinha: {
      em_andamento: false,
      cultura: 'milho_braquiaria',
      nome: crop,
      semeadura: '2027-02-18',
      colheita: '2027-06-18',
      explorar_ano: 2024,
    },
  }
}

export function createMockAvisosRepository(delayMs = 300): AvisosRepository {
  return {
    async get(point, lang) {
      await delay(delayMs)
      return buildAvisos(point, lang)
    },
  }
}
