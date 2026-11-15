import { describe, expect, it } from 'vitest'
import type { AnoDetalhe, Opcao } from '../models/recomendacao'
import { clearEnsoNotes, selectedYear, yearBars } from './suggestionService'

/** Valores de teste (não são de fonte real). */
function opcao(id: Opcao['id'], anosBons: number, renda: number, solo: number, final: number, extra: Partial<Opcao> = {}): Opcao {
  return {
    id,
    nome: id,
    na_janela: true,
    chuva: { anos_bons: anosBons, anos: 20, faixa: [], rotulo: 'bom', texto: `chuva ${id}` },
    data_limite: '2027-02-28',
    futuro: null,
    renda: { da_grao: renda > 0, anos_aperto: 20 - anosBons, rotulo: 'bom', texto: `renda ${id}`, risco: `risco ${id}` },
    terra: { nota: solo, rotulo: 'bom', texto: `terra ${id}` },
    notas: { seguranca: anosBons * 5, futuro: null, solo, renda, final },
    porque: [],
    como_fazer: [],
    ...extra,
  }
}

function ano(year: number, isna: number, extra: Partial<AnoDetalhe> = {}): AnoDetalhe {
  const bom = isna >= 0.55
  return {
    ano: year,
    bom,
    fase_critica: `${year}-04-18`,
    dias_sem_chuva: 0,
    enso: null,
    texto: `Ano ${year}`,
    isna,
    dias_calor: 0,
    falta_agua: !bom,
    calor: false,
    semeadura: `${year}-02-18`,
    umidade_inicial: null,
    ...extra,
  }
}

describe('yearBars (explorador ano a ano)', () => {
  const criterio = { isna_min: 0.55, calor_temp_c: 35, calor_min_dias: 3, fase: 'floracao' as const, janela_dias: 15 }

  it('uma barra por ano com a água da fase crítica em % do que a planta precisa e a linha de corte', () => {
    const option = opcao('sorgo', 1, 75, 35, 64, {
      criterio,
      anos_detalhe: [ano(2015, 1), ano(2016, 0.33, { enso: 'el_nino' }), ano(2017, 0.91, { calor: true, dias_calor: 4, bom: false })],
    })
    expect(yearBars(option)).toEqual({
      cutPct: 55,
      bars: [
        { year: 2015, pct: 100, good: true, reason: null, enso: null },
        { year: 2016, pct: 33, good: false, reason: 'agua', enso: 'el_nino' },
        { year: 2017, pct: 91, good: false, reason: 'calor', enso: null },
      ],
    })
  })

  it('falta de água e calor no mesmo ano', () => {
    const option = opcao('sorgo', 0, 75, 35, 64, { criterio, anos_detalhe: [ano(2010, 0.2, { calor: true })] })
    expect(yearBars(option)?.bars[0].reason).toBe('ambos')
  })

  it('sem o ISNA de cada ano ou sem o critério (API antiga), o explorador não aparece', () => {
    const old = { ...ano(2015, 1), isna: undefined }
    expect(yearBars(opcao('sorgo', 1, 75, 35, 64, { criterio, anos_detalhe: [old] }))).toBeNull()
    expect(yearBars(opcao('sorgo', 1, 75, 35, 64, { anos_detalhe: [ano(2015, 1)] }))).toBeNull()
  })
})

describe('selectedYear', () => {
  const option = opcao('sorgo', 1, 75, 35, 64, { anos_detalhe: [ano(2015, 1), ano(2016, 0.3)] })

  it('o ano tocado, se ele está na série', () => {
    expect(selectedYear(option, 2016)?.ano).toBe(2016)
    expect(selectedYear(option, 1999)).toBeNull()
    expect(selectedYear(option, null)).toBeNull()
  })
})

describe('clearEnsoNotes (El Niño e La Niña)', () => {
  it('só as fases com diferença clara, pelo critério do motor', () => {
    const option = opcao('sorgo', 15, 75, 35, 64, {
      enso_acerto: [
        { fase: 'el_nino', anos: 7, bons: 4, anos_outros: 13, bons_outros: 11, clara: true },
        { fase: 'la_nina', anos: 8, bons: 6, anos_outros: 12, bons_outros: 9, clara: false },
      ],
    })
    expect(clearEnsoNotes(option)).toEqual([{ fase: 'el_nino', anos: 7, bons: 4, anos_outros: 13, bons_outros: 11, clara: true }])
    expect(clearEnsoNotes(opcao('sorgo', 15, 75, 35, 64))).toEqual([])
  })
})
