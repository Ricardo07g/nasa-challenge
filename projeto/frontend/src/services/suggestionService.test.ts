import { describe, expect, it } from 'vitest'
import type { AnoDetalhe, CropId, Opcao, Recomendacao } from '../models/recomendacao'
import { guideService } from './guideService'
import {
  SUGGESTION_ARTICLES,
  buildSuggestion,
  clearEnsoNotes,
  cropArticle,
  lateNotice,
  optionsForObjective,
  rankForObjective,
  selectedYear,
  suggestedPlan,
  thirstByCrop,
  yearBars,
} from './suggestionService'

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

const OPTIONS = [
  opcao('milho_braquiaria', 16, 80, 50, 70),
  opcao('sorgo', 15, 75, 35, 64),
  opcao('crotalaria', 19, 0, 85, 58),
]

function rec(extra: Partial<Recomendacao> = {}): Recomendacao {
  return {
    entrada: { celula_id: 'x', colheita: 'meio', semeadura: '2027-02-18', solo: 'argiloso', nematoide: null },
    melhor: 'milho_braquiaria',
    alternativas: [],
    opcoes: OPTIONS,
    fora_da_janela: [],
    pousio: { texto: 'pousio' },
    plano_3_anos: {
      normal: { anos: ['milho_braquiaria', 'milho_braquiaria', 'crotalaria'], nota: 80, descricao: 'a' },
      seco: { anos: ['milho_braquiaria', 'crotalaria', 'crotalaria'], nota: 70, descricao: 'b' },
      hoje: { anos: ['milho_safrinha', 'milho_safrinha', 'milho_safrinha'], nota: 60, descricao: 'c' },
    },
    versao_dados: 'teste',
    aviso: 'aviso',
    objetivos: {
      equilibrio: { ordem: ['milho_braquiaria', 'sorgo', 'crotalaria'], plano: ['milho_braquiaria', 'milho_braquiaria', 'crotalaria'], nota_plano: 80 },
      seguranca: { ordem: ['crotalaria', 'milho_braquiaria', 'sorgo'], plano: ['crotalaria', 'milho_braquiaria', 'crotalaria'], nota_plano: 70 },
      renda: { ordem: ['milho_braquiaria', 'sorgo', 'crotalaria'], plano: ['milho_braquiaria', 'milho_braquiaria', 'milho_braquiaria'], nota_plano: 77 },
      terra: { ordem: ['crotalaria', 'milho_braquiaria', 'sorgo'], plano: ['crotalaria', 'crotalaria', 'crotalaria'], nota_plano: 64 },
    },
    ...extra,
  }
}

describe('rankForObjective (seção 5.1: a ordem vem pronta do motor)', () => {
  it('sem objetivo, vale a ordem do equilíbrio', () => {
    expect(rankForObjective(rec(), null).map((o) => o.id)).toEqual(['milho_braquiaria', 'sorgo', 'crotalaria'])
  })

  it('com objetivo, a ordem do motor para ele', () => {
    expect(rankForObjective(rec(), 'terra').map((o) => o.id)).toEqual(['crotalaria', 'milho_braquiaria', 'sorgo'])
  })

  it('sem os objetivos na API (versão antiga), reordena pelo eixo no navegador como antes (RF-05)', () => {
    const old = rec({ objetivos: undefined })
    expect(rankForObjective(old, 'seguranca').map((o) => o.id)).toEqual(['crotalaria', 'milho_braquiaria', 'sorgo'])
    expect(rankForObjective(old, null).map((o) => o.id)).toEqual(['milho_braquiaria', 'sorgo', 'crotalaria'])
  })
})

describe('optionsForObjective (aba Comparar)', () => {
  it('as que cabem na janela na ordem do objetivo; as fora da janela vão para o fim', () => {
    const late = opcao('milho_safrinha', 10, 60, 20, 50, { na_janela: false })
    const summary = optionsForObjective(rec({ opcoes: [...OPTIONS, late], fora_da_janela: [{ id: 'milho_safrinha', nome: 'Milho sozinho', texto: 'x' }] }), 'terra')

    expect(summary.options.map((o) => o.id)).toEqual(['crotalaria', 'milho_braquiaria', 'sorgo', 'milho_safrinha'])
    expect(summary.late.names).toEqual(['Milho sozinho'])
  })
})

describe('thirstByCrop (selo de sede no Plano)', () => {
  it('a sede de cada cultura que tem a linha Água; sem ela, a cultura fica de fora', () => {
    const agua = (sede: 'pouca' | 'muita') => ({ precisa_mm: 1, chove_mm: 1, falta_normal_mm: 0, falta_seco_mm: 0, sede, cad_mm: 60, anos: 20, futuro: null })
    const options = [opcao('sorgo', 15, 75, 35, 64, { agua: agua('muita') }), opcao('crotalaria', 19, 0, 85, 58, { agua: agua('pouca') }), opcao('milheto', 19, 0, 55, 50)]

    expect(thirstByCrop(rec({ opcoes: options }))).toEqual({ sorgo: 'muita', crotalaria: 'pouca' })
  })
})

describe('suggestedPlan', () => {
  it('o plano do objetivo, que começa pela 1ª opção da ordem', () => {
    expect(suggestedPlan(rec(), 'seguranca')).toEqual(['crotalaria', 'milho_braquiaria', 'crotalaria'])
  })

  it('sem os objetivos na API, o Plano A', () => {
    expect(suggestedPlan(rec({ objetivos: undefined }), null)).toEqual(['milho_braquiaria', 'milho_braquiaria', 'crotalaria'])
  })
})

describe('buildSuggestion (aba Sugestão)', () => {
  it('a melhor opção do objetivo é o ano 1 do plano, com os 3 anos depois da soja', () => {
    const s = buildSuggestion(rec(), 'terra')
    expect(s?.best.id).toBe('crotalaria')
    expect(s?.plan).toEqual([
      { year: 2027, crop: 'crotalaria' },
      { year: 2028, crop: 'crotalaria' },
      { year: 2029, crop: 'crotalaria' },
    ])
  })

  it('só mostra a geada quando algum ano teve geada', () => {
    expect(buildSuggestion(rec({ geada: { anos: 0, total: 20, tmin_max_c: 3, meses: [5, 6, 7] } }), null)?.frost).toBeNull()
    expect(buildSuggestion(rec({ geada: { anos: 2, total: 20, tmin_max_c: 3, meses: [5, 6, 7] } }), null)?.frost?.anos).toBe(2)
  })

  it('sem nenhuma opção na janela, não há sugestão', () => {
    expect(buildSuggestion(rec({ opcoes: [], objetivos: {} }), null)).toBeNull()
  })
})

describe('lateNotice (colheita tarde: um aviso só, com a lista montada)', () => {
  it('junta as culturas pela data limite do ZARC, na ordem em que vieram', () => {
    const notice = lateNotice(
      rec({
        fora_da_janela: [
          { id: 'milho_safrinha', nome: 'Milho sozinho', texto: 'x', data_limite: '2027-02-28' },
          { id: 'milho_braquiaria', nome: 'Milho com braquiária', texto: 'y', data_limite: '2027-02-28' },
          { id: 'milheto', nome: 'Milheto', texto: 'z', data_limite: '2027-03-15' },
        ],
      }),
    )
    expect(notice).toEqual({
      groups: [
        { date: '2027-02-28', names: ['Milho sozinho', 'Milho com braquiária'] },
        { date: '2027-03-15', names: ['Milheto'] },
      ],
      count: 3,
    })
  })

  it('sem a data limite (API antiga), uma lista sem data; sem nada fora da janela, nenhum aviso', () => {
    expect(lateNotice(rec({ fora_da_janela: [{ id: 'crotalaria', nome: 'Crotalária', texto: 'x' }] }))).toEqual({
      groups: [{ date: null, names: ['Crotalária'] }],
      count: 1,
    })
    expect(lateNotice(rec())).toBeNull()
  })
})

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

describe('links "Saiba mais" da aba Sugestão (seção 8 da remodelagem)', () => {
  const slug = (path: string) => path.replace('/guia/', '')

  it('cada cultura leva ao artigo dela no Guia, que existe em pt e en', () => {
    const crops: CropId[] = ['milho_safrinha', 'milho_braquiaria', 'sorgo', 'milheto', 'crotalaria', 'pousio']
    for (const crop of crops) {
      expect(guideService.get('pt', slug(cropArticle(crop)))?.plant).toBe(crop)
      expect(guideService.get('en', slug(cropArticle(crop)))).not.toBeNull()
    }
  })

  it('os artigos de deu certo, água, El Niño, clima 2041–2060, ZARC e geada existem', () => {
    for (const path of Object.values(SUGGESTION_ARTICLES)) {
      expect(guideService.get('pt', slug(path))).not.toBeNull()
      expect(guideService.get('en', slug(path))).not.toBeNull()
    }
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
