/**
 * Raio-X de EXEMPLO no formato do contrato `GET /api/raio-x` (VITE_API_MODE=mock, tarefa 0043). Os
 * números são ilustrativos e combinam com o talhão de exemplo (terra média, 2017 a 2026 com 5 anos
 * parados, 4 plantados e 1 sem certeza). No modo de demonstração toda tela avisa que não é dado da NASA.
 */
import type { Lang } from '../../i18n/language'
import type { FaixaNdvi, RaioX, RaioXParams } from '../../models/raioX'
import { ApiError } from '../httpClient'
import { MOCK_PILOT_AREA as AREA } from './mockLocation'

const COLUMNS = ['01-01', '01-17', '02-02', '02-18', '03-06', '03-22', '04-07', '04-23', '05-09', '05-25', '06-10', '06-26', '07-12', '07-28']

/** O mesmo exemplo do talhão: p = parado, v = plantou, i = sem certeza. */
const YEARS = 'pvpvpivppv'

function ndviRow(kind: string, index: number): (number | null)[] {
  const soy = [0.84, 0.88, 0.82, 0.38]
  const after = { p: [0.33, 0.36, 0.38, 0.35, 0.32, 0.3, 0.29, 0.28, 0.27, 0.26], v: [0.45, 0.62, 0.74, 0.78, 0.76, 0.7, 0.6, 0.48, 0.4, 0.35], i: [0.4, 0.48, 0.52, 0.5, 0.47, 0.44, 0.4, 0.36, 0.33, 0.3] }[kind]!
  const row = [...soy, ...after]
  // Uma leitura com nuvem em alguns anos: sem dado nessa coluna.
  if (index % 3 === 1) row[2] = null as unknown as number
  return row
}

const STRIP: FaixaNdvi = {
  colunas: COLUMNS,
  anos: [...YEARS].map((kind, index) => ({ ano: 2017 + index, valores: ndviRow(kind, index) })),
  fonte: 'MODIS MOD13Q1 + MYD13Q1',
  colheita_dia: '02-15',
}

const YEARS_2005_2024 = Array.from({ length: 20 }, (_, index) => 2005 + index)

function insideBox({ lat, lon }: { lat: number; lon: number }): boolean {
  return lat >= AREA.min_lat && lat <= AREA.max_lat && lon >= AREA.min_lon && lon <= AREA.max_lon
}

export function buildRaioX(params: RaioXParams, lang: Lang): RaioX {
  void lang // o raio-X só tem números; o idioma fica aqui para o formato ser igual ao da API
  // Mesmo erro que a API: ponto fora da área preparada → 404 OUTSIDE_AREA.
  if (!insideBox(params)) throw new ApiError('/api/raio-x', 404, 'OUTSIDE_AREA')
  const cad = { arenoso: 40, medio: 50, argiloso: 60 }[params.solo ?? 'medio']
  return {
    ponto: { lat: params.lat, lon: params.lon },
    celula_id: `${Math.floor(params.lat * 10)}_${Math.floor(params.lon * 10)}`,
    leitura_recente: '2026-11-10',
    altitude_m: null,
    solo: { textura: 'medio', argila_pct: 32, areia_pct: 48, cad_mm: 50, vizinho_km: null },
    agua: {
      cad_mm: cad,
      dias: Math.floor(cad / 4.3),
      cultura: 'milho_braquiaria',
      nome: 'Milho com braquiária',
      floracao: '04-19',
      eto_mm_dia: 3.6,
      kc: 1.2,
      consumo_mm_dia: 4.3,
      fonte_eto: 'nasa_power',
    },
    umidade: { percentil: 41, data: '2026-11-10' },
    verde: {
      ultimo_ndvi: 0.35,
      ultimo_data: '2026-07-28',
      pico_ndvi: 0.88,
      pico_data: '2026-01-17',
      safra: '2025/26',
      fonte: 'MODIS MOD13Q1 + MYD13Q1',
    },
    chuva: {
      media_mm: 880,
      anos: YEARS_2005_2024,
      fonte: 'gpm_imerg',
      fim_das_chuvas: {
        mediana: '04-18',
        mais_cedo: { dia: '03-20', ano: 2016 },
        mais_tarde: { dia: '05-25', ano: 2009 },
        anos: YEARS_2005_2024,
        fonte: 'gpm_imerg',
        inicio: '03-01',
        dias: 20,
        chuva_max_mm: 10,
      },
    },
    veranico: { dias: 31, ano: 2021, inicio: '04-02', total_anos: 20, fonte: 'gpm_imerg' },
    calor: { anos_com_calor: 2, total_anos: 20, temp_c: 35, anos: [2019, 2024], fonte: 'nasa_power' },
    regiao: {
      chuva_mm: 312,
      mediana_regiao_mm: 330,
      celulas: 225,
      pct_mais_seca: 64,
      pct_mais_chuvosa: 35,
      fonte: 'gpm_imerg',
    },
    historico_ndvi: STRIP,
    alertas: {
      geada: null,
      chuva_forte: { media_dias_ano: 0.3, dias: 6, total_anos: 20, limite_mm: 50, fonte: 'gpm_imerg' },
      fogo: null,
    },
    cartoes: {
      chuva_20_anos: { cultura: 'milho_braquiaria', nome: 'Milho com braquiária', anos_bons: 16, total_anos: 20 },
      clima_futuro: {
        chuva_pct: -4.5,
        tmax_c: 1.6,
        modelos: 3,
        modelos_menos_chuva: 2,
        modelos_mais_chuva: 1,
        modelos_mais_quente: 3,
        cenario: 'ssp245',
        periodo: '2041-2060',
      },
    },
  }
}
