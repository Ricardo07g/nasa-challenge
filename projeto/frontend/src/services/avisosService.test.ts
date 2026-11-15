import { describe, expect, it, vi } from 'vitest'
import type { Aviso, Avisos } from '../models/avisos'
import type { SafraPassada } from '../models/pastSeason'
import { buildAvisos } from '../repositories/mocks/mockAvisos'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import type { SavedPointRepository } from '../repositories/savedPointRepository'
import {
  activeCount,
  alertsPoint,
  alertsSummary,
  changeTiles,
  createAvisosService,
  exampleRows,
  exampleYear,
  headerCount,
  isWorse,
  nowAlerts,
  planCropOf,
  planLine,
  pointFromFlow,
  recentReadings,
  recordTiles,
  viewPointFromFlow,
} from './avisosService'

const POINT = { lat: -18.9543, lon: -48.1993, colheita: 'meio' as const }

function savedPoints(initial: SavedPointRepository['get'] extends () => infer P ? P : never = null) {
  let point = initial
  return { get: vi.fn(() => point), save: vi.fn((p) => (point = p)) } satisfies SavedPointRepository
}

function aviso(tipo: string, valores: Aviso['valores'], changes: Partial<Aviso> = {}): Aviso {
  return { tipo, nivel: 'fique_de_olho', fontes: ['gpm_imerg'], data: '2024-07-30', antiga: false, valores, ...changes }
}

function withNow(avisos: Aviso[], contador = avisos.length): Avisos {
  const base = buildAvisos(POINT, 'pt')
  return { ...base, contador, agora: { avisos, ultima_leitura: '2026-11-12' } }
}

describe('avisosService (tela "Avisos")', () => {
  it('pede os avisos uma vez por ponto e idioma na visita (o botão do cabeçalho e a tela usam o mesmo)', async () => {
    const repository = { get: vi.fn((point, lang) => Promise.resolve(buildAvisos(point, lang))) }
    const service = createAvisosService(repository, savedPoints())

    await service.get(POINT, 'pt')
    await service.get({ ...POINT }, 'pt')
    await service.get(POINT, 'en')
    await service.get({ ...POINT, colheita: 'tarde' }, 'pt')

    expect(repository.get).toHaveBeenCalledTimes(3)
  })

  it('a cultura do plano vai à API e o cache separa por cultura (tarefa 0065)', async () => {
    const repository = { get: vi.fn((point, lang) => Promise.resolve(buildAvisos(point, lang))) }
    const service = createAvisosService(repository, savedPoints())

    await service.get(POINT, 'pt', 'sorgo')
    await service.get({ ...POINT }, 'pt', 'sorgo')
    await service.get(POINT, 'pt')
    await service.get(POINT, 'pt', null)
    await service.get(POINT, 'pt', 'milheto')

    expect(repository.get).toHaveBeenCalledTimes(3)
    expect(repository.get).toHaveBeenNthCalledWith(1, POINT, 'pt', 'sorgo')
    expect(repository.get).toHaveBeenNthCalledWith(2, POINT, 'pt', null)
  })

  it('pede de novo depois de uma falha', async () => {
    const repository = {
      get: vi.fn().mockRejectedValueOnce(new Error('fora do ar')).mockResolvedValue(buildAvisos(POINT, 'pt')),
    }
    const service = createAvisosService(repository, savedPoints())

    await expect(service.get(POINT, 'pt')).rejects.toThrow('fora do ar')
    await expect(service.get(POINT, 'pt')).resolves.toMatchObject({ contador: 2 })
  })

  it('lê e guarda o ponto salvo no aparelho', () => {
    const saved = savedPoints()
    const service = createAvisosService({ get: vi.fn() }, saved)

    service.savePoint(POINT)

    expect(saved.save).toHaveBeenCalledWith(POINT)
    expect(service.savedPoint()).toEqual(POINT)
  })

  it('o ponto do fluxo vale para guardar, menos a fazenda de exemplo', () => {
    expect(pointFromFlow(null)).toBeNull()
    expect(pointFromFlow({ lat: -18.9, lon: -48.2, exemplo: true, colheita: 'meio' })).toBeNull()
    expect(
      pointFromFlow({ lat: -18.9, lon: -48.2, exemplo: false, colheita: 'tarde', solo: 'arenoso', confirmadas: '2025:parado' }),
    ).toEqual({ lat: -18.9, lon: -48.2, colheita: 'tarde', solo: 'arenoso', confirmadas: '2025:parado' })
    expect(pointFromFlow({ lat: -18.9, lon: -48.2, exemplo: false, confirmadas: '' })).toEqual({ lat: -18.9, lon: -48.2 })
  })

  it('pacote 2: guarda junto a data, as respostas das safras e a escolha atual; o confirmadas sai das respostas', () => {
    expect(
      pointFromFlow({
        lat: -18.9,
        lon: -48.2,
        exemplo: false,
        data: '2027-02-18',
        safras: '2024:milho_braquiaria,2025:pousio,2026:soja',
        pensa: 'sorgo',
      }),
    ).toEqual({
      lat: -18.9,
      lon: -48.2,
      data: '2027-02-18',
      safras: '2024:milho_braquiaria,2025:pousio,2026:soja',
      pensa: 'sorgo',
      confirmadas: '2024:plantou,2025:parado',
    })
  })

  it('pacote 3: guarda também a cultura do 1º ano do plano e o objetivo da tela 5', () => {
    expect(pointFromFlow({ lat: -18.9, lon: -48.2, exemplo: false, escolha: 'sorgo', objetivo: 'renda' })).toEqual({
      lat: -18.9,
      lon: -48.2,
      escolha: 'sorgo',
      objetivo: 'renda',
    })
  })

  it('pacote 3: a tela mostra a lavoura de demonstração (marcada como exemplo), que nunca é guardada', () => {
    expect(viewPointFromFlow(null)).toBeNull()
    expect(viewPointFromFlow({ lat: -18.9543, lon: -48.1993, exemplo: true, colheita: 'tarde' })).toEqual({
      lat: -18.9543,
      lon: -48.1993,
      colheita: 'tarde',
      exemplo: true,
    })
    expect(viewPointFromFlow({ lat: -19.3, lon: -48.9, exemplo: false })).toEqual({ lat: -19.3, lon: -48.9 })
  })

  it('o ponto da URL vem antes do salvo; sem nenhum, não há avisos', () => {
    const saved = { lat: -19.5, lon: -48.9 }

    expect(alertsPoint(POINT, saved)).toBe(POINT)
    expect(alertsPoint(null, saved)).toBe(saved)
    expect(alertsPoint(null, null)).toBeNull()
  })

  it('o botão do cabeçalho só mostra número com aviso ativo', () => {
    expect(headerCount(buildAvisos(POINT, 'pt'))).toBe(2)
    expect(headerCount(withNow([], 0))).toBeNull()
    expect(headerCount(undefined)).toBeNull()
  })

  it('diz se a mudança foi para pior (veranico maior, chuva acabando antes, menos anos bons)', () => {
    expect(isWorse(aviso('mudou_veranico', { antes: 20.8, recente: 27.2 }))).toBe(true)
    expect(isWorse(aviso('mudou_calor', { antes: 2, recente: 0.5 }))).toBe(false)
    expect(isWorse(aviso('mudou_falta_agua', { antes: 101.6, recente: 177.4 }))).toBe(true)
    expect(isWorse(aviso('mudou_fim_chuvas', { antes: '04-24', recente: '04-13', diferenca_dias: -11 }))).toBe(true)
    expect(isWorse(aviso('mudou_fim_chuvas', { antes: '04-13', recente: '04-24', diferenca_dias: 11 }))).toBe(false)
    expect(
      isWorse(aviso('mudou_deu_certo', { antes_bons: 13, antes_total: 15, recente_bons: 3, recente_total: 5 })),
    ).toBe(true)
    expect(isWorse(aviso('recorde_veranico', { dias: 43 }))).toBeNull()
  })
})

describe('avisosService: o resumo do topo (pacote 3, tela 7)', () => {
  const watch = aviso('enso', {}, { nivel: 'fique_de_olho' })
  const attention = aviso('terra_seca', {}, { nivel: 'atencao' })

  it('sem aviso: verde, "Nada fora do normal agora"', () => {
    expect(alertsSummary(withNow([], 0))).toEqual({ count: 0, attention: 0, tone: 'ok' })
  })

  it('só "Fique de olho": azul', () => {
    expect(alertsSummary(withNow([watch]))).toEqual({ count: 1, attention: 0, tone: 'watch' })
  })

  it('com algum "Atenção": laranja, com quantos pedem atenção', () => {
    expect(alertsSummary(withNow([watch, attention, aviso('calor', {}, { nivel: 'atencao' })]))).toEqual({
      count: 3,
      attention: 2,
      tone: 'attention',
    })
  })

  it('o número do resumo é o mesmo do sino: só os avisos que a tela mostra (os cartões de "Agora")', () => {
    const avisos = withNow([watch, attention, aviso('tipo_novo', {}, { nivel: 'atencao' })])

    expect(activeCount(avisos)).toBe(2)
    expect(alertsSummary(avisos).count).toBe(2)
    expect(headerCount(avisos)).toBe(2)
  })

  it('o número não usa o `contador` da API: um relato de vizinho (API antiga, com o "Perto de você") não conta', () => {
    const neighbor = aviso('vizinho_evento', { evento: 'geada', relatos: 1 }, { fontes: ['comunidade'] })
    const avisos: Avisos = { ...withNow([watch], 2), perto: { avisos: [neighbor], ultima_leitura: '2026-11-15' } }
    const onlyNeighbor: Avisos = { ...withNow([], 1), perto: { avisos: [neighbor], ultima_leitura: '2026-11-15' } }

    expect(alertsSummary(avisos)).toEqual({ count: 1, attention: 0, tone: 'watch' })
    expect(headerCount(avisos)).toBe(1)
    expect(alertsSummary(onlyNeighbor).tone).toBe('ok')
    expect(headerCount(onlyNeighbor)).toBeNull()
  })
})

describe('avisosService: os cartões de "Agora"', () => {
  it('"Atenção" vem antes, na ordem da API dentro de cada nível; tipo desconhecido não aparece', () => {
    const enso = aviso('enso', {}, { nivel: 'fique_de_olho' })
    const dry = aviso('terra_seca', {}, { nivel: 'atencao' })
    const heat = aviso('calor', {}, { nivel: 'atencao' })
    const unknown = aviso('tipo_novo', {}, { nivel: 'atencao' })

    expect(nowAlerts(withNow([enso, dry, unknown, heat])).map((a) => a.tipo)).toEqual(['terra_seca', 'calor', 'enso'])
  })

  it('"Perto de você" (relatos de vizinhos) nunca vira cartão', () => {
    const avisos = buildAvisos(POINT, 'pt')
    const withNeighbor: Avisos = {
      ...avisos,
      perto: { avisos: [aviso('vizinho_evento', { evento: 'geada', relatos: 1 }, { fontes: ['comunidade'] })], ultima_leitura: null },
    }

    expect(nowAlerts(withNeighbor).map((a) => a.tipo)).not.toContain('vizinho_evento')
  })

  it('as leituras são "desta semana" com a última até 7 dias antes de hoje', () => {
    expect(recentReadings('2026-11-15', '2026-11-12')).toBe(true)
    expect(recentReadings('2026-11-15', '2026-11-08')).toBe(true)
    expect(recentReadings('2026-11-15', '2026-11-07')).toBe(false)
    expect(recentReadings('2026-11-15', null)).toBe(false)
  })
})

describe('avisosService: "Como a sua área está mudando" e "Já aconteceu aqui"', () => {
  it('até 4 quadros, na ordem do pedido: veranico, fim das chuvas, falta de água, deu certo (e calor, se couber)', () => {
    const avisos = buildAvisos(POINT, 'pt')

    expect(changeTiles(avisos, 'milho_braquiaria').map((a) => a.tipo)).toEqual([
      'mudou_veranico',
      'mudou_fim_chuvas',
      'mudou_falta_agua',
      'mudou_deu_certo',
    ])
  })

  it('os quadros da cultura só valem para a cultura do 1º ano do plano: de outra cultura, não aparecem', () => {
    const avisos = buildAvisos(POINT, 'pt')

    expect(changeTiles(avisos, 'sorgo').map((a) => a.tipo)).toEqual(['mudou_veranico', 'mudou_fim_chuvas', 'mudou_calor'])
    expect(changeTiles(avisos, null).map((a) => a.tipo)).toEqual([
      'mudou_veranico',
      'mudou_fim_chuvas',
      'mudou_falta_agua',
      'mudou_deu_certo',
    ])
  })

  it('sem o grupo (sem série), nenhum quadro', () => {
    const avisos: Avisos = { ...buildAvisos(POINT, 'pt'), mudou: null, recordes: null }

    expect(changeTiles(avisos, null)).toEqual([])
    expect(recordTiles(avisos)).toEqual([])
  })

  it('os 4 recordes na ordem: maior veranico, outono mais seco, chuva que acabou mais cedo, ano com mais calor', () => {
    const avisos = buildAvisos(POINT, 'pt')
    const shuffled: Avisos = { ...avisos, recordes: { ...avisos.recordes!, avisos: [...avisos.recordes!.avisos].reverse() } }

    expect(recordTiles(shuffled).map((a) => a.tipo)).toEqual([
      'recorde_veranico',
      'recorde_outono_seco',
      'recorde_fim_chuvas',
      'recorde_calor',
    ])
  })
})

describe('avisosService: a linha "Seu plano"', () => {
  const rec = buildRecomendacao({ ...POINT, colheita: 'tarde' }, 'pt')

  it('a cultura do 1º ano: a escolha da tela 5, senão o que pensa plantar, senão a sugestão', () => {
    expect(planCropOf({ ...POINT, escolha: 'sorgo', pensa: 'milheto' }, rec, 'milho_braquiaria')).toBe('sorgo')
    expect(planCropOf({ ...POINT, pensa: 'milheto' }, rec, 'milho_braquiaria')).toBe('milheto')
    expect(planCropOf({ ...POINT, pensa: 'nao_sei' }, rec, 'sorgo')).toBe('milho_braquiaria')
  })

  it('sem a recomendação, a escolha, o que pensa plantar ou a sugestão dos avisos (`safrinha.cultura`)', () => {
    expect(planCropOf({ ...POINT, escolha: 'crotalaria' }, null, 'milheto')).toBe('crotalaria')
    expect(planCropOf({ ...POINT, pensa: 'sorgo' }, null, 'milheto')).toBe('sorgo')
    expect(planCropOf(POINT, null, 'milheto')).toBe('milheto')
    expect(planCropOf(POINT, null, null)).toBeNull()
    expect(planCropOf(POINT, null, 'cultura_estranha')).toBeNull()
  })

  it('o prazo é o mesmo "Prazo para plantar" da tela 5 (`data_limite`); fora do prazo, avisa', () => {
    expect(planLine('sorgo', rec)).toEqual({ crop: 'sorgo', deadline: '2027-03-20', late: false })
    expect(planLine('milho_safrinha', rec)).toEqual({ crop: 'milho_safrinha', deadline: '2027-02-28', late: true })
  })

  it('sem a recomendação ou sem a data, a linha fica sem o prazo; sem cultura, não há linha', () => {
    expect(planLine('sorgo', null)).toEqual({ crop: 'sorgo', deadline: null, late: false })
    expect(planLine('pousio', rec)).toEqual({ crop: 'pousio', deadline: null, late: false })
    expect(planLine(null, rec)).toBeNull()
  })
})

describe('avisosService: "Ver exemplo: avisos de <ano>"', () => {
  const replay: SafraPassada = {
    ano: 2024,
    opcao: 'sorgo',
    eventos: [
      { data: '2024-03-03', tipo: 'semeadura', texto: 'Semeadura: Sorgo.' },
      { data: '2024-04-19', tipo: 'sem_chuva', texto: 'Parou de chover.' },
      { data: '2024-04-28', tipo: 'aviso_veranico', texto: 'Aviso: 10 dias sem chuva perto da fase que mais precisa de água.' },
      { data: '2024-05-07', tipo: 'fase_critica', texto: 'Floração.' },
      { data: '2024-05-10', tipo: 'aviso_calor', texto: 'Aviso: 2 dias seguidos com 35 °C ou mais.' },
      { data: '2024-06-26', tipo: 'colheita', texto: 'Colheita: Sorgo.' },
    ],
  }

  it('o ano é o último da série, só fora da safrinha', () => {
    const avisos = buildAvisos(POINT, 'pt')

    expect(exampleYear(avisos)).toBe(2024)
    expect(exampleYear({ ...avisos, safrinha: { ...avisos.safrinha!, em_andamento: true, explorar_ano: null } })).toBeNull()
    expect(exampleYear({ ...avisos, safrinha: null })).toBeNull()
  })

  it('junta os avisos do replay daquele ano (com o dia em que parou de chover) e os recordes do mesmo ano', () => {
    const rows = exampleRows(2024, replay, buildAvisos(POINT, 'pt'))

    expect(rows).toEqual([
      { kind: 'replay', tipo: 'aviso_veranico', date: '2024-04-28', texto: replay.eventos[2].texto, since: '2024-04-19' },
      { kind: 'replay', tipo: 'aviso_calor', date: '2024-05-10', texto: replay.eventos[4].texto, since: null },
      { kind: 'record', aviso: expect.objectContaining({ tipo: 'recorde_veranico' }) },
      { kind: 'record', aviso: expect.objectContaining({ tipo: 'recorde_calor' }) },
    ])
  })

  it('sem o replay (cultura fora do prazo ou falha), só os recordes; recordes de outro ano não entram', () => {
    const rows = exampleRows(2021, null, buildAvisos(POINT, 'pt'))

    expect(rows.map((row) => (row.kind === 'record' ? row.aviso.tipo : row.tipo))).toEqual([
      'recorde_outono_seco',
      'recorde_fim_chuvas',
    ])
  })
})
