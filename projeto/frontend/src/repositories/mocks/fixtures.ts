/**
 * Dados de EXEMPLO no formato exato dos contratos do plano técnico (§3). Usados enquanto o motor do
 * backend não existe (VITE_API_MODE=mock). Os números são ilustrativos, coerentes com as regras de
 * rótulo do §4.4 (Chuva: Bom ≥ 17 anos, Médio 12–16; Renda: Bom ≥ 70; Terra: Bom ≥ 50). Nenhum valor em
 * reais (tarefa 0040): a renda do grão é a segurança climática da opção; quem não dá grão fica com 0.
 */
import type { Lang } from '../../i18n/language'
import type { AnoDetalhe, CropId, Motivo, Opcao, Recomendacao, RecomendacaoParams, Rotulo, Sede } from '../../models/recomendacao'
import { MOCK_PILOT_AREA as AREA } from './mockLocation'
import { CLIMA_FUTURO_EXEMPLO } from './raioXFixture'
import type { CustoAtraso, CustoAtrasoParams } from '../../models/custoAtraso'
import {
  COLHEITAS,
  type ChuvaMensal,
  type ChuvaQueSobra,
  type Colheita,
  type FimDasChuvas,
  type Ponto,
  type SituacaoAno,
  type Talhao,
} from '../../models/talhao'

/** O backend responde `dentro_da_area: false` fora da caixa preparada; o mock imita isso. */
function insideBox({ lat, lon }: Ponto): boolean {
  return lat >= AREA.min_lat && lat <= AREA.max_lat && lon >= AREA.min_lon && lon <= AREA.max_lon
}

type Text = Record<Lang, string>
type TextList = Record<Lang, string[]>

/** Anos (índice 0 = 2006) em que faltou água, do pior para o menos ruim. */
const DRY_YEARS = [1, 8, 12, 15, 18, 5, 10, 3]

function rainStrip(goodYears: number): boolean[] {
  const bad = new Set(DRY_YEARS.slice(0, 20 - goodYears))
  return Array.from({ length: 20 }, (_, index) => !bad.has(index))
}

function rainLabel(goodYears: number): Rotulo {
  if (goodYears >= 17) return 'bom'
  if (goodYears >= 12) return 'medio'
  return 'fraco'
}

/** Renda só com fatos, com as mesmas frases do regras.yaml do backend (tarefa 0040). */
function incomeText(lang: Lang, grain: boolean): string {
  if (lang === 'pt') return grain ? 'Dá grão para vender' : 'Não dá grão: é investimento na terra'
  return grain ? 'Gives grain to sell' : 'No grain: it is an investment in the soil'
}

function riskText(lang: Lang, badYears: number): string {
  return lang === 'pt'
    ? `Risco de perder a lavoura: faltou água ou fez calor em ${badYears} de 20 anos.`
    : `Risk of losing the crop: water ran short or it was too hot in ${badYears} of 20 years.`
}

type CropSeed = {
  id: Exclude<CropId, 'pousio'>
  name: Text
  goodYears: number
  /** Dá grão para vender (grão e consórcio). */
  grain: boolean
  incomeLabel: Rotulo
  soil: { nota: number; rotulo: Rotulo; texto: Text }
  notes: Opcao['notas']
  limit: string
  why: TextList
  how: TextList
}

const CROPS: CropSeed[] = [
  {
    id: 'milho_braquiaria',
    name: { pt: 'Milho com braquiária', en: 'Corn with brachiaria' },
    goodYears: 14,
    grain: true,
    incomeLabel: 'bom',
    soil: { nota: 50, rotulo: 'bom', texto: { pt: 'Fica coberta na seca', en: 'Stays covered in the dry season' } },
    notes: { seguranca: 70, futuro: 60, solo: 50, renda: 70, final: 66 },
    limit: '2027-02-28',
    why: {
      pt: [
        'Plantando no meio de fevereiro, o milho floresce em abril. Em 6 dos últimos 20 anos, faltou chuva bem nessa hora (GPM IMERG + NASA POWER).',
        'A braquiária cresce junto e cobre a terra até a próxima soja.',
        'No clima de 2041–2060 (NEX-GDDP-CMIP6), a falta de chuva subiria para 8 em 20 anos.',
      ],
      en: [
        'Planted in mid-February, the corn flowers in April. In 6 of the last 20 years, rain was short right then (GPM IMERG + NASA POWER).',
        'The brachiaria grows alongside and covers the soil until the next soybean crop.',
        'In the 2041–2060 climate (NEX-GDDP-CMIP6), the shortage would rise to 8 in 20 years.',
      ],
    },
    how: {
      pt: ['Semeie o capim junto com o milho.', 'Colha o milho. O capim fica cobrindo a terra.', 'Plante a próxima soja em cima da palhada.'],
      en: ['Sow the grass together with the corn.', 'Harvest the corn. The grass keeps the soil covered.', 'Plant the next soybeans on top of the straw.'],
    },
  },
  {
    id: 'sorgo',
    name: { pt: 'Sorgo', en: 'Sorghum' },
    goodYears: 17,
    grain: true,
    incomeLabel: 'bom',
    soil: { nota: 30, rotulo: 'medio', texto: { pt: 'Palhada média', en: 'Medium straw' } },
    notes: { seguranca: 85, futuro: 75, solo: 30, renda: 85, final: 62 },
    limit: '2027-03-20',
    why: {
      pt: [
        'O sorgo aguenta mais a seca que o milho: faltou chuva na floração em só 3 dos últimos 20 anos (GPM IMERG + NASA POWER).',
        'Pode ser plantado até cerca de 20 dias depois do limite do milho (Embrapa).',
      ],
      en: [
        'Sorghum handles drought better than corn: rain was short at flowering in only 3 of the last 20 years (GPM IMERG + NASA POWER).',
        'It can be planted up to about 20 days after the corn deadline (Embrapa).',
      ],
    },
    how: {
      pt: ['Semeie o sorgo logo depois de colher a soja.', 'Colha o grão em junho ou julho.', 'Deixe a palhada para a próxima soja.'],
      en: ['Sow the sorghum right after the soybean harvest.', 'Harvest the grain in June or July.', 'Leave the straw for the next soybeans.'],
    },
  },
  {
    id: 'milho_safrinha',
    name: { pt: 'Milho sozinho', en: 'Corn alone' },
    goodYears: 14,
    grain: true,
    incomeLabel: 'bom',
    soil: { nota: 10, rotulo: 'fraco', texto: { pt: 'Pouca cobertura', en: 'Little soil cover' } },
    notes: { seguranca: 70, futuro: 55, solo: 10, renda: 70, final: 58 },
    limit: '2027-02-28',
    why: {
      pt: [
        'Dá grão para vender, mas faltou chuva na floração em 6 dos últimos 20 anos (GPM IMERG + NASA POWER).',
        'Depois da colheita, a terra fica com pouca palha até a próxima soja.',
      ],
      en: [
        'It gives grain to sell, but rain was short at flowering in 6 of the last 20 years (GPM IMERG + NASA POWER).',
        'After harvest, the soil has little straw until the next soybeans.',
      ],
    },
    how: {
      pt: ['Semeie o milho logo depois de colher a soja.', 'Colha o milho no inverno.', 'Se der, cubra a terra antes da próxima soja.'],
      en: ['Sow the corn right after the soybean harvest.', 'Harvest the corn in winter.', 'If you can, cover the soil before the next soybeans.'],
    },
  },
  {
    id: 'crotalaria',
    name: { pt: 'Crotalária', en: 'Crotalaria' },
    goodYears: 17,
    grain: false,
    incomeLabel: 'fraco',
    soil: {
      nota: 80,
      rotulo: 'bom',
      texto: { pt: 'Adubo verde, ajuda a baixar o nematoide', en: 'Green manure, helps lower nematodes' },
    },
    notes: { seguranca: 85, futuro: 80, solo: 80, renda: 0, final: 55 },
    limit: '2027-02-28',
    why: {
      pt: [
        'Deixa de 60 a 100 kg de nitrogênio por hectare para a próxima soja e é altamente resistente ao nematoide.',
        'Não tem colheita: é investimento na terra.',
      ],
      en: [
        'It leaves 60 to 100 kg of nitrogen per hectare for the next soybeans and is highly resistant to nematodes.',
        'There is no harvest: it is an investment in the soil.',
      ],
    },
    how: {
      pt: ['Semeie a crotalária a lanço ou em linha.', 'Deixe crescer até florescer.', 'Roce e plante a soja em cima da palhada.'],
      en: ['Sow the crotalaria broadcast or in rows.', 'Let it grow until it flowers.', 'Mow it and plant the soybeans on top of the straw.'],
    },
  },
  {
    id: 'milheto',
    name: { pt: 'Milheto', en: 'Pearl millet' },
    goodYears: 16,
    grain: false,
    incomeLabel: 'fraco',
    soil: { nota: 60, rotulo: 'bom', texto: { pt: 'Muita palhada', en: 'Lots of straw' } },
    notes: { seguranca: 80, futuro: 70, solo: 60, renda: 0, final: 52 },
    limit: '2027-03-31',
    why: {
      pt: [
        'Cresce rápido e forma muita palha, mesmo com pouca chuva no fim do verão.',
        'Ajuda no controle do nematoide das lesões (Pratylenchus).',
      ],
      en: [
        'It grows fast and makes lots of straw, even with little rain at the end of summer.',
        'It helps control the root-lesion nematode (Pratylenchus).',
      ],
    },
    how: {
      pt: ['Semeie o milheto logo depois da soja.', 'Deixe crescer e formar palha.', 'Plante a soja direto sobre a palha.'],
      en: ['Sow the pearl millet right after the soybeans.', 'Let it grow and form straw.', 'Plant the soybeans directly on the straw.'],
    },
  },
]

function rainText(lang: Lang, good: number): string {
  return lang === 'pt' ? `Deu certo em ${good} de 20 anos` : `Worked in ${good} of 20 years`
}

/** Anos de El Niño e La Niña no verão antes da safrinha (ilustrativo, NOAA). */
const ENSO: Record<number, AnoDetalhe['enso']> = {
  2007: 'el_nino',
  2008: 'la_nina',
  2010: 'el_nino',
  2011: 'la_nina',
  2012: 'la_nina',
  2016: 'el_nino',
  2021: 'la_nina',
  2022: 'la_nina',
  2024: 'el_nino',
}

/** Aba Sugestão (tarefa 0044): água no ciclo em mm (precisa, chove, falta normal e seca), ciclo e floração. */
const WATER: Record<CropSeed['id'], { mm: [number, number, number, number]; sede: Sede; cycle: [number, number] }> = {
  milho_braquiaria: { mm: [346, 400, 116, 158], sede: 'muita', cycle: [120, 60] },
  milho_safrinha: { mm: [346, 400, 116, 158], sede: 'muita', cycle: [120, 60] },
  sorgo: { mm: [303, 398, 83, 114], sede: 'media', cycle: [115, 65] },
  crotalaria: { mm: [262, 392, 42, 87], sede: 'pouca', cycle: [100, 60] },
  milheto: { mm: [242, 376, 25, 77], sede: 'pouca', cycle: [90, 50] },
}

const COVER: ReadonlySet<CropId> = new Set(['crotalaria', 'milheto'])

function suggestionFields(seed: CropSeed, details: AnoDetalhe[]): Partial<Opcao> {
  const water = WATER[seed.id]
  const [precisa, chove, normal, seco] = water.mm
  const cover = COVER.has(seed.id)
  const nino = details.filter((d) => d.enso === 'el_nino')
  const others = details.filter((d) => d.enso !== 'el_nino')
  return {
    agua: {
      precisa_mm: precisa,
      chove_mm: chove,
      falta_normal_mm: normal,
      falta_seco_mm: seco,
      sede: water.sede,
      cad_mm: 60,
      anos: 20,
      futuro: { falta_normal_mm: normal + 12, falta_min_mm: normal + 2, falta_max_mm: normal + 25, mudanca_mm: 12, modelos: 3 },
    },
    criterio: cover
      ? { isna_min: 0.5, calor_temp_c: 35, calor_min_dias: 3, fase: 'pegamento', janela_dias: 30 }
      : { isna_min: 0.55, calor_temp_c: 35, calor_min_dias: 3, fase: 'floracao', janela_dias: 15 },
    ciclo: { dias: water.cycle[0], floracao_dias: water.cycle[1] },
    observar: { veranico_dias: cover ? 4 : 9, anos_calor: cover ? 1 : 0, total: 20 },
    enso_acerto: [
      {
        fase: 'el_nino',
        anos: nino.length,
        bons: nino.filter((d) => d.bom).length,
        anos_outros: others.length,
        bons_outros: others.filter((d) => d.bom).length,
        clara: seed.id === 'sorgo',
      },
    ],
  }
}

/** P1: uma frase por ano da faixa de chuva (dados de exemplo). */
function yearDetails(strip: boolean[], lang: Lang): AnoDetalhe[] {
  return strip.map((bom, index) => {
    const ano = 2006 + index
    const dias = 10 + ((index * 7) % 9)
    const enso = ENSO[ano] ?? null
    const ensoText = enso === null ? '' : lang === 'pt' ? (enso === 'el_nino' ? ' Ano de El Niño.' : ' Ano de La Niña.') : enso === 'el_nino' ? ' El Niño year.' : ' La Niña year.'
    const texto =
      lang === 'pt'
        ? bom
          ? `Em ${ano}, a fase que mais precisa de água foi por volta de 15 de abril e choveu o bastante.`
          : `Em ${ano}, a planta chegou na fase que mais precisa de água por volta de 15 de abril e ficou ${dias} dias sem chuva.`
        : bom
          ? `In ${ano}, the stage that needs water most was around April 15 and there was enough rain.`
          : `In ${ano}, the crop reached the stage that needs water most around April 15 and went ${dias} days without rain.`
    return {
      ano,
      bom,
      fase_critica: `${ano}-04-15`,
      dias_sem_chuva: bom ? 0 : dias,
      enso,
      texto: texto + ensoText,
      // Explorador ano a ano (tarefa 0044): água na fase crítica em fração do que a planta precisa
      isna: bom ? Math.min(1, 0.7 + (index % 4) * 0.1) : 0.3 + (index % 3) * 0.08,
      dias_calor: 0,
      falta_agua: !bom,
      calor: false,
      semeadura: `${ano}-02-18`,
      umidade_inicial: ano >= 2016 ? 0.4 : null,
    }
  })
}

function buildOption(seed: CropSeed, lang: Lang): Opcao {
  const details = yearDetails(rainStrip(seed.goodYears), lang)
  return {
    ...suggestionFields(seed, details),
    id: seed.id,
    nome: seed.name[lang],
    na_janela: true,
    data_limite: seed.limit,
    // Como a API (tarefa 0066 do backend): não há ZARC de crotalária, a data dela é sugestão do app
    prazo_zarc: seed.id !== 'crotalaria',
    chuva: {
      anos_bons: seed.goodYears,
      anos: 20,
      faixa: rainStrip(seed.goodYears),
      rotulo: rainLabel(seed.goodYears),
      texto: rainText(lang, seed.goodYears),
    },
    futuro: {
      anos_bons_media: seed.goodYears - 2,
      anos_bons_min: seed.goodYears - 4,
      anos_bons_max: seed.goodYears - 1,
      modelos: 3,
      cenario: 'ssp245',
    },
    renda: {
      da_grao: seed.grain,
      anos_aperto: 20 - seed.goodYears,
      rotulo: seed.incomeLabel,
      texto: incomeText(lang, seed.grain),
      risco: riskText(lang, 20 - seed.goodYears),
    },
    terra: { nota: seed.soil.nota, rotulo: seed.soil.rotulo, texto: seed.soil.texto[lang] },
    notas: seed.notes,
    porque: seed.why[lang],
    como_fazer: seed.how[lang],
    anos_detalhe: details,
  }
}

/**
 * Ordem e plano de cada objetivo (tarefa 0044), como o motor manda: a nota do eixo, desempate pela final. O
 * plano do equilíbrio é o Plano A (`planA`), que começa pela melhor opção.
 */
function objectives(opcoes: Opcao[], planA: CropId[]): Recomendacao['objetivos'] {
  const axes = {
    equilibrio: (o: Opcao) => o.notas.final,
    seguranca: (o: Opcao) => o.notas.seguranca,
    renda: (o: Opcao) => o.notas.renda,
    terra: (o: Opcao) => o.notas.solo,
  }
  return Object.fromEntries(
    Object.entries(axes).map(([key, axis]) => {
      const ordem = [...opcoes].sort((a, b) => axis(b) - axis(a) || b.notas.final - a.notas.final).map((o) => o.id)
      const plano = key === 'equilibrio' ? planA : [ordem[0], ordem[1] ?? ordem[0], ordem[0]]
      return [key, { ordem, plano, nota_plano: 66 }]
    }),
  )
}

const SOWING: Record<Colheita, string> = { cedo: '2027-02-08', meio: '2027-02-18', tarde: '2027-03-02' }

export function cellId({ lat, lon }: Ponto): string {
  return `${Math.floor(lat * 10)}_${Math.floor(lon * 10)}`
}

/** Chuva de cada mês, de janeiro a junho: os números da fazenda de exemplo (NASA POWER, 2005 a 2024). */
const YEARS_2005_2024 = Array.from({ length: 20 }, (_, index) => 2005 + index)

/** Chuva e gasto da lavoura (ETo) de cada mês, de exemplo: a chuva fica abaixo do gasto em abril. */
const ETO_BY_MONTH = [130.2, 118.4, 120.1, 105.3, 95.6, 88.0]
const MONTHLY_RAIN: ChuvaMensal = {
  meses: [212.7, 161.0, 156.8, 74.7, 31.3, 12.6].map((media_mm, index) => ({
    mes: index + 1,
    media_mm,
    eto_media_mm: ETO_BY_MONTH[index],
  })),
  anos: YEARS_2005_2024,
  fonte: 'nasa_power',
  fonte_eto: 'nasa_power',
  mes_chuva_abaixo_eto: 4,
}

/** Dias de 15/jan a 31/mar ("MM-DD"), num ano comum, como a API manda. */
function harvestDays(): string[] {
  const days: string[] = []
  for (let day = new Date(Date.UTC(2023, 0, 15)); day <= new Date(Date.UTC(2023, 2, 31)); day.setUTCDate(day.getUTCDate() + 1)) {
    days.push(`${String(day.getUTCMonth() + 1).padStart(2, '0')}-${String(day.getUTCDate()).padStart(2, '0')}`)
  }
  return days
}

/** Chuva que sobra de exemplo: cai de ~620 mm (15/jan) a ~140 mm (31/mar); o ano seco é ~75% disso. */
const RAIN_LEFT: ChuvaQueSobra = {
  fim: '06-30',
  percentil_seco: 20,
  dias: harvestDays().map((dia, index, all) => {
    const mediana = Math.round((620 - (480 * index) / (all.length - 1)) * 10) / 10
    return { dia, mediana_mm: mediana, seco_mm: Math.round(mediana * 7.5) / 10 }
  }),
  anos: YEARS_2005_2024,
  fonte: 'nasa_power',
}

const RAIN_END: FimDasChuvas = {
  mediana: '04-18',
  mais_cedo: { dia: '03-20', ano: 2016 },
  mais_tarde: { dia: '05-25', ano: 2009 },
  anos: YEARS_2005_2024,
  fonte: 'nasa_power',
  inicio: '03-01',
  dias: 20,
  chuva_max_mm: 10,
}

/** Custo do atraso de exemplo: a melhor opção da recomendação de exemplo em cada faixa. */
export function buildCustoAtraso(params: CustoAtrasoParams, lang: Lang): CustoAtraso {
  const faixas = COLHEITAS.map((colheita) => {
    const rec = buildRecomendacao({ ...params, colheita }, lang)
    const best = rec.opcoes.find((opcao) => opcao.id === rec.melhor)!
    return {
      colheita,
      semeadura: rec.entrada.semeadura,
      melhor: best.id,
      nome: best.nome,
      anos_bons: best.chuva.anos_bons,
      total_anos: best.chuva.anos,
    }
  })
  return { faixas, mesma_cultura: new Set(faixas.map((faixa) => faixa.melhor)).size === 1 }
}

/** As 3 últimas entressafras, que o produtor confirma na tela 4 (como a API manda). */
const CONFIRMABLE_YEARS = [2024, 2025, 2026]

export function buildTalhao(point: Ponto, lang: Lang): Talhao {
  void lang // o talhão não tem textos; o idioma fica aqui para o formato ser igual ao da API
  if (!insideBox(point)) {
    return {
      ponto: point,
      celula_id: null,
      dentro_da_area: false,
      solo: null,
      colheita_sugerida: null,
      historico: null,
      dados: [],
      chuva_mensal: null,
      soja_recente: null,
      anos_confirmaveis: CONFIRMABLE_YEARS,
      chuva_que_sobra: null,
      fim_das_chuvas: null,
    }
  }
  // Exemplo do guia do NDVI, de 2017 a 2026: 5 anos parados, 4 plantados e 1 em que o satélite não
  // teve certeza.
  const situacoes: SituacaoAno[] = [
    'parado',
    'plantou',
    'parado',
    'plantou',
    'parado',
    'incerto',
    'plantou',
    'parado',
    'parado',
    'plantou',
  ]
  const NDVI_MAX: Record<SituacaoAno, number | null> = {
    plantou: 0.71,
    parado: 0.42,
    incerto: 0.52,
    sem_dado: null,
    sem_soja: null,
  }
  const anos = situacoes.map((situacao, index) => ({
    ano: 2017 + index,
    situacao,
    ndvi_max: NDVI_MAX[situacao],
    n_obs: situacao === 'sem_dado' ? 1 : 12,
    fonte_ano: 'satelite' as const,
  }))
  const count = (...which: SituacaoAno[]) => anos.filter((ano) => which.includes(ano.situacao)).length
  return {
    ponto: point,
    celula_id: cellId(point),
    dentro_da_area: true,
    solo: { textura: 'medio', cad_mm: 50, fonte: 'soilgrids' },
    colheita_sugerida: { faixa: 'meio', fonte: 'ndvi_modis', anos_usados: 9, dia: '02-15' },
    historico: {
      anos,
      parado: count('parado'),
      plantou: count('plantou'),
      sem_certeza: count('incerto', 'sem_dado'),
      sem_soja: count('sem_soja'),
      total: anos.length,
      fonte: 'MODIS MOD13Q1 + MYD13Q1',
      janela: '04-01 a 07-31',
    },
    dados: [
      { fonte: 'gpm_imerg', periodo: '2006-2025' },
      { fonte: 'nasa_power', periodo: '2006-2025' },
      { fonte: 'nex_gddp_cmip6', periodo: '2041-2060', cenario: 'ssp245', modelos: 3 },
    ],
    chuva_mensal: MONTHLY_RAIN,
    // Soja vista na última safra: no modo de demonstração, a tela 3 não avisa (RF-24).
    soja_recente: { safra: '2025/26', vista: true, ndvi_pico: 0.86, fonte: 'MODIS MOD13Q1 + MYD13Q1' },
    anos_confirmaveis: CONFIRMABLE_YEARS,
    chuva_que_sobra: RAIN_LEFT,
    fim_das_chuvas: RAIN_END,
  }
}

/** Plano A de exemplo: começa pela melhor opção (tarefa 0044). */
const PLAN_A: CropId[] = ['milho_braquiaria', 'crotalaria', 'sorgo']

const OUT_OF_WINDOW: Text = {
  pt: 'Colhendo a soja depois do dia 20, o milho sozinho passa da data do zoneamento (ZARC).',
  en: 'Harvesting soybeans after the 20th, corn alone misses the zoning deadline (ZARC).',
}

export function buildRecomendacao(params: RecomendacaoParams, lang: Lang): Recomendacao {
  const all = CROPS.map((seed) => buildOption(seed, lang))
  const late = params.colheita === 'tarde'
  const inWindow = late ? all.filter((opcao) => opcao.id !== 'milho_safrinha') : all
  // Tarefa 0056: a cultura fora do prazo também vem com a conta, depois das que estão no prazo.
  const outOfWindow: Opcao[] = late
    ? all
        .filter((opcao) => opcao.id === 'milho_safrinha')
        .map((opcao) => ({ ...opcao, na_janela: false, fora_do_prazo: true, data_limite: '2027-02-28' }))
    : []
  const opcoes = [...inWindow.map((opcao) => ({ ...opcao, fora_do_prazo: false })), ...outOfWindow]
  const objetivos = objectives(inWindow, PLAN_A)
  for (const objetivo of Object.values(objetivos ?? {})) objetivo?.ordem.push(...outOfWindow.map((opcao) => opcao.id))
  const alternativas: { motivo: Motivo; opcao: CropId }[] = [
    { motivo: 'menos_risco', opcao: 'milheto' },
    { motivo: 'mais_renda', opcao: 'sorgo' },
    { motivo: 'cuidar_da_terra', opcao: 'crotalaria' },
  ]
  return {
    entrada: {
      celula_id: cellId(params),
      colheita: params.colheita,
      semeadura: SOWING[params.colheita],
      solo: params.solo ?? 'medio',
      nematoide: null,
    },
    melhor: 'milho_braquiaria',
    alternativas: late ? alternativas.filter((alt) => alt.opcao !== 'milho_safrinha') : alternativas,
    opcoes,
    fora_da_janela: late
      ? [
          {
            id: 'milho_safrinha',
            nome: all.find((o) => o.id === 'milho_safrinha')!.nome,
            texto: OUT_OF_WINDOW[lang],
            data_limite: '2027-02-28',
          },
        ]
      : [],
    objetivos,
    clima_futuro: CLIMA_FUTURO_EXEMPLO,
    geada: late ? { anos: [2011], total_anos: 20, temp_c: 3, menor_temp_c: 2.4, fonte: 'nasa_power' } : null,
    pousio: {
      texto:
        lang === 'pt'
          ? 'Deixar parado: não depende de chuva, mas a terra fica descoberta de maio a setembro.'
          : 'Leaving it fallow: it does not depend on rain, but the soil stays bare from May to September.',
    },
    plano_3_anos: {
      normal: {
        anos: PLAN_A,
        nota: 66,
        descricao: lang === 'pt' ? 'Grão em 2 anos e terra coberta nos 3.' : 'Grain in 2 years and soil covered in all 3.',
      },
      seco: {
        anos: ['sorgo', 'crotalaria', 'sorgo'],
        nota: 58,
        descricao: lang === 'pt' ? 'Troca o milho pelo sorgo no ano seco.' : 'Swaps corn for sorghum in the dry year.',
      },
      hoje: {
        anos: ['milho_safrinha', 'pousio', 'milho_safrinha'],
        nota: 48,
        descricao: lang === 'pt' ? 'Terra descoberta em metade dos anos' : 'Soil bare in half of the years',
      },
    },
    sinal: {
      nivel: 'incerto',
      motivo:
        lang === 'pt'
          ? 'Previsão para fevereiro a abril de 2027 (NOAA): nenhuma fase se destaca (La Niña 30%, neutro 40%, El Niño 30%).'
          : 'Forecast for February to April 2027 (NOAA): no phase stands out (La Niña 30%, neutral 40%, El Niño 30%).',
      fonte: ['NOAA', 'NASA POWER', 'SMAP'],
      data: '2026-11-12',
      smap_agora: {
        percentil: 59,
        data: '2026-11-10',
        texto:
          lang === 'pt'
            ? 'Sua terra está um pouco mais úmida que o normal agora (SMAP, percentil 59, 10/11/2026).'
            : 'Your soil is a little wetter than normal right now (SMAP, percentile 59, Nov 10, 2026).',
      },
    },
    versao_dados: '2026-11-14T13:00Z',
    aviso:
      lang === 'pt'
        ? 'Ajuda a decidir. Não substitui o agrônomo.'
        : 'It helps you decide. It does not replace the agronomist.',
  }
}
