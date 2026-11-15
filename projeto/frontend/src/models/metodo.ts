/**
 * Contrato do `GET /api/metodo` (tarefa 0049 do backend): os números das regras que a tela "Como a conta é feita"
 * explica, lidos do `regras.yaml`. A tela nunca repete número fixo.
 */
export type MetodoRegras = {
  deu_certo: {
    isna_grao_pct: number
    isna_cobertura_pct: number
    /** Floração ± estes dias. */
    janela_grao_meia_dias: number
    /** Os primeiros dias da planta de cobertura. */
    janela_cobertura_dias: number
    calor_temp_c: number
    calor_min_dias: number
  }
  pesos: { seguranca_pct: number; futuro_pct: number; solo_pct: number; renda_pct: number }
  renda: { tipos_com_grao: string[]; nota_sem_grao: number }
  agua: { sede_pouca_ate_mm: number; sede_muita_desde_mm: number; percentil_seco: number }
  rotacao: { bonus_diversidade_2: number; bonus_diversidade_3: number; max_pousios: number; culturas_supressoras_nematoide: string[] }
  plano_b: {
    dias_antes_semeadura: number
    anos_falha_min: number
    sensibilidade_min_pct: number
    precisao_min_pct: number
    chance_max_pct: number
  }
  /** Datas em "MM-DD". */
  alertas: {
    geada_temp_c: number
    geada_inicio: string
    geada_fim: string
    chuva_forte_mm: number
    chuva_forte_inicio: string
    chuva_forte_fim: string
    fogo_raio_km: number
  }
  avisos: {
    terra_seca_percentil_max: number
    dias_sem_chuva_min: number
    calor_dias_min: number
    calor_janela_dias: number
    vizinhos_dias: number
    raio_km: number
  }
  sinal: { estacao_previsao: string; fase_chance_min_pct: number; anos_fase_min: number; anos_ruins_seco_pct: number }
}
