import { describe, expect, it } from 'vitest'
import type { AnoPlano, PlanoAB, PlanoAvaliado } from '../models/plano'
import type { RaioX } from '../models/raioX'
import type { CropId, Opcao, SinalOutono } from '../models/recomendacao'
import type { Colheita } from '../models/talhao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { buildPlano } from '../repositories/mocks/mockPlano'
import { buildRaioX } from '../repositories/mocks/raioXFixture'
import {
  addDays,
  harvestDay,
  lastSeasons,
  pastFutureRows,
  planGain,
  planningAlerts,
  planTimeline,
  sowingDay,
  type TimelineStep,
} from './planningService'

const point = { lat: -18.9543, lon: -48.1993 }

function option(colheita: Colheita, id: CropId): Opcao {
  return buildRecomendacao({ ...point, colheita }, 'pt').opcoes.find((item) => item.id === id)!
}

const SIGNAL: SinalOutono = {
  nivel: 'seco',
  motivo: 'Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA). Nos 7 anos de El Niño desde 2005, sorgo deu certo em 3 e milheto em 7.',
  fonte: ['NOAA', 'GPM IMERG', 'SMAP'],
  data: '2026-11-12',
}

const AB: PlanoAB = {
  cultura_a: 'sorgo',
  nome_a: 'Sorgo',
  falhas_a: 9,
  total: 20,
  cultura_b: 'milheto',
  nome_b: 'Milheto',
  b_bons_nas_falhas: 9,
  limite: null,
  motivo: null,
}

function step<K extends TimelineStep['kind']>(steps: TimelineStep[], kind: K): Extract<TimelineStep, { kind: K }> {
  const found = steps.find((item) => item.kind === kind)
  if (!found) throw new Error(`sem o passo ${kind}`)
  return found as Extract<TimelineStep, { kind: K }>
}

describe('harvestDay e sowingDay (a colheita e o plantio da linha do tempo)', () => {
  it('a data da tela 2 vale mais; só com a época, o dia da época no motor', () => {
    expect(harvestDay('2027-03-03', 'tarde')).toBe('2027-03-03')
    expect(harvestDay(null, 'cedo')).toBe('2027-02-05')
    expect(harvestDay(null, 'meio')).toBe('2027-02-15')
    expect(harvestDay(undefined, 'tarde')).toBe('2027-02-28')
  })

  it('plantar: logo depois de colher (a data da tela 2) ou a semeadura do motor, como na tela 5', () => {
    expect(sowingDay('2027-03-03', '2027-03-03')).toBe('2027-03-03')
    expect(sowingDay(null, '2027-02-18')).toBe('2027-02-18')
  })

  it('soma dias sem depender do fuso', () => {
    expect(addDays('2027-03-03', 65)).toBe('2027-05-07')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
  })
})

describe('planTimeline ("O que fazer agora", montado por regra)', () => {
  const base = {
    today: '2026-11-15',
    season: 2027,
    signal: SIGNAL,
    planAB: AB,
    firstCrop: 'sorgo' as CropId,
    secondCrop: 'milheto' as CropId,
  }

  it('a ordem dos passos: agora, fevereiro, colheita, plantio, fase da água, colheita da cultura e a próxima soja', () => {
    const steps = planTimeline({ ...base, harvest: '2027-03-03', sowing: '2027-03-03', first: option('tarde', 'sorgo') })
    expect(steps.map((item) => item.kind)).toEqual(['now', 'signal', 'harvest', 'plant', 'water', 'cropHarvest', 'next'])
    expect(step(steps, 'now')).toEqual({ kind: 'now', from: '2026-11-15', to: '2027-03-03' })
    expect(step(steps, 'next')).toEqual({ kind: 'next', year: 2027, crop: 'milheto', deadline: null, late: false, zarc: true })
  })

  it('a próxima soja leva o prazo do ZARC do 2º ano (tarefa 0065), marcado quando passou do prazo', () => {
    const first = option('tarde', 'sorgo')
    const inTime = planTimeline({ ...base, harvest: '2027-03-03', sowing: '2027-03-03', first, secondDeadline: '2028-03-15' })
    const late = planTimeline({ ...base, harvest: '2027-03-03', sowing: '2027-03-03', first, secondDeadline: '2028-02-28', secondLate: true })

    expect(step(inTime, 'next')).toEqual({ kind: 'next', year: 2027, crop: 'milheto', deadline: '2028-03-15', late: false, zarc: true })
    expect(step(late, 'next')).toMatchObject({ deadline: '2028-02-28', late: true })
  })

  it.each([
    // época, colheita do motor, semeadura do motor, o prazo do ZARC do sorgo no exemplo
    ['cedo', '2027-02-05', '2027-02-08'],
    ['meio', '2027-02-15', '2027-02-18'],
    ['tarde', '2027-02-28', '2027-03-03'],
  ] as const)('colheita %s (só a época): as datas saem da colheita e da semeadura do motor', (band, harvest, sowing) => {
    const sorgo = option(band, 'sorgo')
    const steps = planTimeline({ ...base, harvest: harvestDay(null, band), sowing, first: sorgo })

    expect(step(steps, 'now').to).toBe(harvest)
    expect(step(steps, 'harvest').date).toBe(harvest)
    expect(step(steps, 'plant')).toEqual({ kind: 'plant', crop: 'sorgo', sowing, deadline: sorgo.data_limite, late: false, zarc: true })
    // Floração do sorgo: plantio + dias até a floração, com a janela do critério antes e depois.
    const flower = addDays(sowing, sorgo.ciclo!.floracao_dias)
    expect(step(steps, 'water')).toEqual({
      kind: 'water',
      crop: 'sorgo',
      phase: 'floracao',
      from: addDays(flower, -sorgo.criterio!.janela_dias),
      to: addDays(flower, sorgo.criterio!.janela_dias),
      flowerDays: sorgo.ciclo!.floracao_dias,
      windowDays: sorgo.criterio!.janela_dias,
    })
    expect(step(steps, 'cropHarvest')).toEqual({ kind: 'cropHarvest', crop: 'sorgo', grain: true, date: addDays(sowing, sorgo.ciclo!.dias) })
  })

  it('a cobertura que precisa de água no pegamento: a fase vai do plantio até o fim da janela; não é colhida', () => {
    const milheto = option('tarde', 'milheto')
    const steps = planTimeline({ ...base, firstCrop: 'milheto', harvest: '2027-03-03', sowing: '2027-03-03', first: milheto, planAB: null })
    expect(step(steps, 'water')).toMatchObject({ phase: 'pegamento', from: '2027-03-03', to: addDays('2027-03-03', milheto.criterio!.janela_dias) })
    expect(step(steps, 'cropHarvest').grain).toBe(false)
  })

  it('a cultura sem ZARC (crotalária, tarefa 0066 do backend): o plantio e a próxima soja dizem que a data é sugerida', () => {
    const crot = { ...option('meio', 'crotalaria'), prazo_zarc: false }
    const dates = { harvest: '2027-02-15', sowing: '2027-02-18' }
    const steps = planTimeline({
      ...base,
      ...dates,
      firstCrop: 'crotalaria',
      first: crot,
      secondCrop: 'crotalaria',
      secondDeadline: '2028-02-28',
      secondZarc: false,
    })
    expect(step(steps, 'plant')).toMatchObject({ zarc: false })
    expect(step(steps, 'next')).toMatchObject({ zarc: false, deadline: '2028-02-28' })
    // API antiga (sem o campo): vem do ZARC
    const sorgo = planTimeline({ ...base, ...dates, first: option('meio', 'sorgo') })
    expect(step(sorgo, 'plant')).toMatchObject({ zarc: true })
    expect(step(sorgo, 'next')).toMatchObject({ zarc: true })
  })

  it('o 1º ano fora do prazo do ZARC: o passo do plantio vem marcado (o aviso laranja)', () => {
    const corn = option('tarde', 'milho_safrinha')
    const steps = planTimeline({ ...base, firstCrop: 'milho_safrinha', harvest: '2027-03-03', sowing: '2027-03-03', first: corn })
    expect(step(steps, 'plant')).toMatchObject({ late: true, deadline: '2027-02-28' })
  })

  it('fevereiro: a previsão da NOAA (fase e %) e a etiqueta do Plano B do motor', () => {
    const steps = planTimeline({ ...base, harvest: '2027-03-03', sowing: '2027-03-03', first: option('tarde', 'sorgo') })
    expect(step(steps, 'signal')).toEqual({
      kind: 'signal',
      year: 2027,
      forecast: 'Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA).',
      planA: 'sorgo',
      planB: { kind: 'b', crop: 'milheto', name: 'Milheto', good: 9, fails: 9 },
      tag: 'milheto',
    })
  })

  it('a etiqueta do Plano B some quando o 1º ano já é o Plano B', () => {
    const steps = planTimeline({
      ...base,
      firstCrop: 'milheto',
      harvest: '2027-03-03',
      sowing: '2027-03-03',
      first: option('tarde', 'milheto'),
      planAB: { ...AB, cultura_a: 'milheto', cultura_b: 'milheto' },
    })
    expect(step(steps, 'signal').tag).toBeNull()
  })

  it('sem Plano B (o 1º ano nunca falhou) também não há etiqueta; sem previsão, o passo fica sem a frase da NOAA', () => {
    const steps = planTimeline({
      ...base,
      firstCrop: 'milheto',
      harvest: '2027-03-03',
      sowing: '2027-03-03',
      first: option('tarde', 'milheto'),
      signal: null,
      planAB: { ...AB, cultura_a: 'milheto', falhas_a: 0, cultura_b: null, nome_b: null, b_bons_nas_falhas: null, motivo: 'nunca_falhou' },
    })
    expect(step(steps, 'signal')).toMatchObject({ forecast: null, tag: null, planB: { kind: 'notNeeded', reason: 'nunca_falhou' } })
  })

  it('1º ano sem lavoura (deixar parado): sem plantio, sem fase da água e sem colheita da cultura', () => {
    const steps = planTimeline({ ...base, firstCrop: 'pousio', harvest: '2027-03-03', sowing: '2027-03-03', first: null, planAB: null })
    expect(steps.map((item) => item.kind)).toEqual(['now', 'signal', 'harvest', 'next'])
  })
})

describe('planningAlerts (alertas da área: até 3, cada um só com dado)', () => {
  const raio = buildRaioX({ ...point, colheita: 'tarde' }, 'pt')
  const withFire: RaioX = { ...raio, alertas: { ...raio.alertas, fogo: { anos: [2016, 2018], total_anos: 10, raio_km: 5, fonte: 'MODIS MCD64A1' } } }

  it('Agora (a previsão da NOAA), chuva forte (GPM IMERG) e fogo (MODIS), nessa ordem', () => {
    expect(planningAlerts(SIGNAL, withFire)).toEqual([
      { kind: 'now', forecast: 'Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA).', source: 'NOAA', date: '2026-11-12' },
      { kind: 'heavyRain', data: withFire.alertas.chuva_forte },
      { kind: 'fire', data: withFire.alertas.fogo },
    ])
  })

  it('alerta sem dado não aparece', () => {
    expect(planningAlerts(null, raio).map((alert) => alert.kind)).toEqual(['heavyRain'])
    expect(planningAlerts(SIGNAL, null).map((alert) => alert.kind)).toEqual(['now'])
    expect(planningAlerts(null, { ...raio, alertas: { geada: null, chuva_forte: null, fogo: null } })).toEqual([])
  })
})

function plano(anos: CropId[], ab: PlanoAB | null = AB): PlanoAvaliado {
  return { ...buildPlano({ ...point, colheita: 'tarde', anos }, 'pt'), plano_ab: ab }
}

const GRAIN: Partial<Record<CropId, boolean>> = { sorgo: true, milho_braquiaria: true, milheto: false, crotalaria: false }

describe('planGain ("Como o plano ajuda a ganhar", por regra)', () => {
  it('os anos com grão, o que as coberturas devolvem e o Plano B', () => {
    const evaluation = plano(['sorgo', 'milheto', 'sorgo'])
    expect(planGain(evaluation, (crop) => GRAIN[crop] ?? null, 2027)).toEqual({
      income: [{ crop: 'sorgo', seasons: [2027, 2029] }],
      covers: [{ crop: 'milheto', season: 2028, straw: true, nitrogen: false, nematode: true }],
      planB: { from: 'sorgo', to: 'milheto' },
    })
  })

  it('sem grão em nenhum ano, sem Plano B; o ano parado não entra', () => {
    const evaluation = plano(['crotalaria', 'pousio', 'milheto'], { ...AB, cultura_b: null, nome_b: null, motivo: 'nunca_falhou' })
    const gain = planGain(evaluation, (crop) => GRAIN[crop] ?? null, 2027)
    expect(gain.income).toEqual([])
    expect(gain.covers.map((cover) => cover.crop)).toEqual(['crotalaria', 'milheto'])
    expect(gain.covers[0]).toMatchObject({ nitrogen: true, nematode: true })
    expect(gain.planB).toBeNull()
  })
})

describe('pastFutureRows (deu certo em 2005–2024 e 2041–2060, por ano do plano)', () => {
  it('uma linha por ano, com a safra', () => {
    const rows = pastFutureRows(plano(['sorgo', 'pousio', 'milheto']), 2027)
    expect(rows.map((row) => [row.season, row.crop])).toEqual([
      [2027, 'sorgo'],
      [2028, 'pousio'],
      [2029, 'milheto'],
    ])
    const sorgo = plano(['sorgo', 'pousio', 'milheto']).anos[0] as AnoPlano
    expect(rows[0]).toEqual({ season: 2027, crop: 'sorgo', good: sorgo.anos_bons, future: sorgo.futuro_anos_bons, total: sorgo.total_anos })
    expect(rows[1]).toMatchObject({ good: null, future: null })
  })
})

describe('lastSeasons ("Últimas safras" do relatório: a resposta ou o satélite)', () => {
  it('a resposta vale mais; sem ela, o que o satélite viu; sem os dois, não preenchido', () => {
    const rows = [
      { year: 2024, satellite: { soy: true, after: 'parado' as const, ndvi: 0.3 } },
      { year: 2025, satellite: { soy: true, after: 'plantou' as const, ndvi: 0.7 } },
      { year: 2026, satellite: { soy: true, after: null, ndvi: 0.5 } },
    ]
    expect(lastSeasons({ 2024: 'milho_braquiaria' }, rows)).toEqual([
      { year: 2024, kind: 'answer', answer: 'milho_braquiaria' },
      { year: 2025, kind: 'satellite', seen: 'plantou' },
      { year: 2026, kind: 'missing' },
    ])
    expect(lastSeasons({}, [{ year: 2024, satellite: { soy: false, after: null, ndvi: null } }, { year: 2025, satellite: null }])).toEqual([
      { year: 2024, kind: 'satellite', seen: 'sem_soja' },
      { year: 2025, kind: 'missing' },
    ])
  })
})
