/**
 * Dados de EXEMPLO no formato exato dos contratos do plano técnico (§3). Usados enquanto o motor do
 * backend não existe (VITE_API_MODE=mock). Os números são ilustrativos, coerentes com as regras de
 * rótulo do §4.4 (Chuva: Bom ≥ 17 anos, Médio 12–16; Dinheiro: Bom ≥ 70; Terra: Bom ≥ 50).
 */
import type { Lang } from '../../i18n/language'
import type { Community } from '../../models/community'
import type { AnoDetalhe, CropId, Motivo, Opcao, Recomendacao, RecomendacaoParams, Rotulo } from '../../models/recomendacao'
import { PREPARED_AREA } from '../../models/area'
import type { ChuvaMensal, Colheita, Ponto, SituacaoAno, Talhao } from '../../models/talhao'

/** O backend responde `dentro_da_area: false` fora da caixa preparada; o mock imita isso. */
function insideBox({ lat, lon }: Ponto): boolean {
  return (
    lat >= PREPARED_AREA.minLat && lat <= PREPARED_AREA.maxLat && lon >= PREPARED_AREA.minLon && lon <= PREPARED_AREA.maxLon
  )
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

function moneyText(lang: Lang, margin: number): string {
  const value = Math.abs(margin).toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US')
  if (lang === 'pt') {
    return margin >= 0 ? `Sobra perto de R$ ${value} por hectare` : `Custa perto de R$ ${value} por hectare`
  }
  return margin >= 0 ? `About R$ ${value} left per hectare` : `Costs about R$ ${value} per hectare`
}

type CropSeed = {
  id: Exclude<CropId, 'pousio'>
  name: Text
  goodYears: number
  margin: number
  moneyLabel: Rotulo
  soil: { nota: number; rotulo: Rotulo; texto: Text }
  notes: Opcao['notas']
  limit: string
  /** Custo da semente e margem do pior ano seco por hectare (RF-21, ilustrativos). */
  seedCost: number
  worstDry: number
  why: TextList
  how: TextList
}

const CROPS: CropSeed[] = [
  {
    id: 'milho_braquiaria',
    name: { pt: 'Milho com braquiária', en: 'Corn with brachiaria' },
    goodYears: 14,
    margin: 700,
    moneyLabel: 'bom',
    soil: { nota: 50, rotulo: 'bom', texto: { pt: 'Fica coberta na seca', en: 'Stays covered in the dry season' } },
    notes: { seguranca: 70, futuro: 60, solo: 50, renda: 74, final: 66 },
    limit: '2027-02-28',
    seedCost: 520,
    worstDry: -180,
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
    margin: 540,
    moneyLabel: 'medio',
    soil: { nota: 30, rotulo: 'medio', texto: { pt: 'Palhada média', en: 'Medium straw' } },
    notes: { seguranca: 85, futuro: 75, solo: 30, renda: 57, final: 62 },
    limit: '2027-03-20',
    seedCost: 160,
    worstDry: 120,
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
    margin: 950,
    moneyLabel: 'bom',
    soil: { nota: 10, rotulo: 'fraco', texto: { pt: 'Pouca cobertura', en: 'Little soil cover' } },
    notes: { seguranca: 70, futuro: 55, solo: 10, renda: 100, final: 58 },
    limit: '2027-02-28',
    seedCost: 480,
    worstDry: -420,
    why: {
      pt: [
        'É a opção que mais rende em ano bom, mas faltou chuva na floração em 6 dos últimos 20 anos (GPM IMERG + NASA POWER).',
        'Depois da colheita, a terra fica com pouca palha até a próxima soja.',
      ],
      en: [
        'It pays the most in a good year, but rain was short at flowering in 6 of the last 20 years (GPM IMERG + NASA POWER).',
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
    margin: -250,
    moneyLabel: 'fraco',
    soil: {
      nota: 80,
      rotulo: 'bom',
      texto: { pt: 'Adubo natural, quebra o nematoide', en: 'Natural fertilizer, breaks the nematode cycle' },
    },
    notes: { seguranca: 85, futuro: 80, solo: 80, renda: 0, final: 55 },
    limit: '2027-02-28',
    seedCost: 250,
    worstDry: -250,
    why: {
      pt: [
        'Deixa de 60 a 100 kg de nitrogênio por hectare para a próxima soja e é altamente resistente ao nematoide.',
        'Não tem colheita: o custo é só a semente.',
      ],
      en: [
        'It leaves 60 to 100 kg of nitrogen per hectare for the next soybeans and is highly resistant to nematodes.',
        'There is no harvest: the cost is only the seed.',
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
    margin: -120,
    moneyLabel: 'fraco',
    soil: { nota: 60, rotulo: 'bom', texto: { pt: 'Muita palhada', en: 'Lots of straw' } },
    notes: { seguranca: 80, futuro: 70, solo: 60, renda: 0, final: 52 },
    limit: '2027-03-31',
    seedCost: 110,
    worstDry: -110,
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
    return { ano, bom, fase_critica: `${ano}-04-15`, dias_sem_chuva: bom ? 0 : dias, enso, texto: texto + ensoText }
  })
}

function buildOption(seed: CropSeed, lang: Lang): Opcao {
  return {
    id: seed.id,
    nome: seed.name[lang],
    na_janela: true,
    data_limite: seed.limit,
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
    dinheiro: {
      margem_ha: seed.margin,
      rotulo: seed.moneyLabel,
      texto: moneyText(lang, seed.margin),
      pior_ano_seco_ha: seed.worstDry,
    },
    terra: { nota: seed.soil.nota, rotulo: seed.soil.rotulo, texto: seed.soil.texto[lang] },
    notas: seed.notes,
    porque: seed.why[lang],
    como_fazer: seed.how[lang],
    custo_semente_ha: seed.seedCost,
    anos_detalhe: yearDetails(rainStrip(seed.goodYears), lang),
  }
}

const SOWING: Record<Colheita, string> = { cedo: '2027-02-08', meio: '2027-02-18', tarde: '2027-03-02' }

export function cellId({ lat, lon }: Ponto): string {
  return `${Math.floor(lat * 10)}_${Math.floor(lon * 10)}`
}

/** Chuva de cada mês, de janeiro a junho: os números da fazenda de exemplo (NASA POWER, 2005 a 2024). */
const MONTHLY_RAIN: ChuvaMensal = {
  meses: [212.7, 161.0, 156.8, 74.7, 31.3, 12.6].map((media_mm, index) => ({ mes: index + 1, media_mm })),
  anos: Array.from({ length: 20 }, (_, index) => 2005 + index),
  fonte: 'nasa_power',
}

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
    }
  }
  // Exemplo do guia do NDVI: 5 anos parados, 4 plantados e 1 em que o satélite não teve certeza.
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
  const NDVI_MAX: Record<SituacaoAno, number | null> = { plantou: 0.71, parado: 0.42, incerto: 0.52, sem_dado: null }
  const anos = situacoes.map((situacao, index) => ({
    ano: 2016 + index,
    situacao,
    ndvi_max: NDVI_MAX[situacao],
    n_obs: situacao === 'sem_dado' ? 1 : 12,
  }))
  const count = (...which: SituacaoAno[]) => anos.filter((ano) => which.includes(ano.situacao)).length
  return {
    ponto: point,
    celula_id: cellId(point),
    dentro_da_area: true,
    solo: { textura: 'medio', cad_mm: 50, fonte: 'soilgrids' },
    colheita_sugerida: { faixa: 'meio', fonte: 'ndvi_modis', anos_usados: 9 },
    historico: {
      anos,
      parado: count('parado'),
      plantou: count('plantou'),
      sem_certeza: count('incerto', 'sem_dado'),
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
  }
}

const OUT_OF_WINDOW: Text = {
  pt: 'Colhendo a soja depois do dia 20, o milho sozinho passa da data do zoneamento (ZARC).',
  en: 'Harvesting soybeans after the 20th, corn alone misses the zoning deadline (ZARC).',
}

export function buildRecomendacao(params: RecomendacaoParams, lang: Lang): Recomendacao {
  const all = CROPS.map((seed) => buildOption(seed, lang))
  const late = params.colheita === 'tarde'
  const opcoes = late ? all.filter((opcao) => opcao.id !== 'milho_safrinha') : all
  const alternativas: { motivo: Motivo; opcao: CropId }[] = [
    { motivo: 'menos_risco', opcao: 'sorgo' },
    { motivo: 'mais_dinheiro', opcao: 'milho_safrinha' },
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
      ? [{ id: 'milho_safrinha', nome: all.find((o) => o.id === 'milho_safrinha')!.nome, texto: OUT_OF_WINDOW[lang] }]
      : [],
    pousio: {
      texto:
        lang === 'pt'
          ? 'Deixar parado: não depende de chuva, mas a terra fica descoberta de maio a setembro.'
          : 'Leaving it fallow: it does not depend on rain, but the soil stays bare from May to September.',
    },
    plano_3_anos: {
      normal: {
        anos: ['milho_braquiaria', 'crotalaria', 'sorgo'],
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
          ? 'A previsão da NASA para março a maio está perto do normal: 40% de chance de chover menos.'
          : 'The NASA outlook for March to May is close to normal: a 40% chance of less rain.',
      fonte: ['GEOS-S2S', 'SMAP'],
      data: '2026-11-10',
      regra_dia_plantar: {
        data_limite: '2027-02-28',
        texto:
          lang === 'pt'
            ? 'No dia de plantar (até 28/fev), se a terra estiver seca, use o plano B: sorgo no lugar do milho.'
            : 'On sowing day (by 28 Feb), if the soil is dry, use plan B: sorghum instead of corn.',
      },
    },
    versao_dados: '2026-11-14T13:00Z',
    aviso:
      lang === 'pt'
        ? 'Ajuda a decidir. Não substitui o agrônomo.'
        : 'It helps you decide. It does not replace the agronomist.',
  }
}

export function buildCommunity(lang: Lang): Community {
  const pt = lang === 'pt'
  return {
    lugar: 'Uberlândia',
    raio_km: 30,
    participantes: 18,
    ano: 2026,
    vizinhos: [
      { opcao: pt ? 'Milho safrinha' : 'Second-crop corn', total: 6, gostaram: 3 },
      { opcao: pt ? 'Parado (pousio)' : 'Left idle (fallow)', total: 4, gostaram: 1 },
      { opcao: pt ? 'Milho + braquiária' : 'Corn + brachiaria', total: 3, gostaram: 2 },
      { opcao: pt ? 'Sorgo' : 'Sorghum', total: 2, gostaram: 2 },
      { opcao: pt ? 'Crotalária' : 'Crotalaria', total: 1, gostaram: 1 },
    ],
    leituras: [
      { lugar: pt ? 'A 6 km, ao norte' : '6 km north', pluviometro_mm: 32, satelite_mm: 24 },
      { lugar: pt ? 'A 11 km, a leste' : '11 km east', pluviometro_mm: 18, satelite_mm: 21 },
      { lugar: pt ? 'A 14 km, ao sul' : '14 km south', pluviometro_mm: 0, satelite_mm: 3 },
    ],
  }
}
