import type { MetodoRegras } from '../../models/metodo'
import type { MetodoRepository } from '../metodoRepository'

/** Regras de exemplo (modo mock), no formato do `GET /api/metodo`, com os números do `regras.yaml` de hoje. */
export const MOCK_METODO: MetodoRegras = {
  deu_certo: { isna_grao_pct: 55, isna_cobertura_pct: 50, janela_grao_meia_dias: 15, janela_cobertura_dias: 30, calor_temp_c: 35, calor_min_dias: 3 },
  pesos: { seguranca_pct: 30, futuro_pct: 15, solo_pct: 25, renda_pct: 30 },
  renda: { tipos_com_grao: ['consorcio', 'grao'], nota_sem_grao: 0 },
  agua: { sede_pouca_ate_mm: 280, sede_muita_desde_mm: 325, percentil_seco: 20 },
  rotacao: { bonus_diversidade_2: 5, bonus_diversidade_3: 10, max_pousios: 2, culturas_supressoras_nematoide: ['crotalaria', 'milheto'] },
  plano_b: { dias_antes_semeadura: 15, anos_falha_min: 3, sensibilidade_min_pct: 50, precisao_min_pct: 60, chance_max_pct: 10 },
  alertas: {
    geada_temp_c: 3,
    geada_inicio: '05-01',
    geada_fim: '07-31',
    chuva_forte_mm: 50,
    chuva_forte_inicio: '02-01',
    chuva_forte_fim: '03-31',
    fogo_raio_km: 5,
  },
  avisos: { terra_seca_percentil_max: 20, dias_sem_chuva_min: 10, calor_dias_min: 3, calor_janela_dias: 10, vizinhos_dias: 7, raio_km: 30 },
  sinal: { estacao_previsao: 'FMA', fase_chance_min_pct: 50, anos_fase_min: 5, anos_ruins_seco_pct: 50 },
}

export function createMockMetodoRepository(): MetodoRepository {
  return { get: () => Promise.resolve(MOCK_METODO) }
}
