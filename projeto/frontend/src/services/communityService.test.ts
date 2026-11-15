import { describe, expect, it, vi } from 'vitest'
import type { NovoRelato, RelatoComunidade, RelatosVizinhos } from '../models/community'
import type { RegiaoSatelite } from '../models/region'
import { ApiError, NotConnectedError } from '../repositories/httpClient'
import {
  addDays,
  cellMarkers,
  COMMUNITY_OPEN,
  createCommunityService,
  dateBounds,
  eventReport,
  isCommunityUnavailable,
  isoDate,
  nearbySummary,
  plantingReport,
  rainReport,
  regionPlace,
  regionSummary,
  reportErrorKind,
} from './communityService'

const point = { lat: -18.9543, lon: -48.1993 }
const TODAY = '2026-11-15'

describe('comunidade "em breve" (pacote 3, tarefa 0061)', () => {
  it('a interface não mostra a comunidade: /comunidade é só o "Em breve" e a tela 4 não oferece compartilhar', () => {
    // O backend e as regras abaixo continuam prontos; para voltar, troque o COMMUNITY_OPEN.
    expect(COMMUNITY_OPEN).toBe(false)
  })
})

function relato(changes: Partial<RelatoComunidade>): RelatoComunidade {
  return {
    id: Math.random().toString(36).slice(2),
    tipo: 'chuva',
    subtipo: null,
    valores: {},
    celula: '-190_-482',
    lat: -18.95,
    lon: -48.15,
    data_fato: TODAY,
    meu: false,
    ...changes,
  }
}

function vizinhos(relatos: RelatoComunidade[]): RelatosVizinhos {
  return { raio_km: 30, anos_safra: [2024, 2025, 2026], relatos }
}

function fakes() {
  const repository = {
    list: vi.fn().mockResolvedValue(vizinhos([])),
    send: vi.fn().mockResolvedValue(relato({ meu: true })),
    remove: vi.fn().mockResolvedValue(undefined),
  }
  const regions = { get: vi.fn() }
  let seen = false
  const device = {
    deviceId: vi.fn(() => 'aparelho-1234'),
    noticeSeen: vi.fn(() => seen),
    markNoticeSeen: vi.fn(() => {
      seen = true
    }),
  }
  return { repository, regions, device, service: createCommunityService(repository, regions, device) }
}

describe('createCommunityService (relatos da comunidade, tarefa 0047)', () => {
  it('lista a redondeza com o identificador do aparelho', async () => {
    const { repository, service } = fakes()

    await service.nearby(point, 'pt')

    expect(repository.list).toHaveBeenCalledWith(point, 'aparelho-1234', 'pt')
  })

  it('envia com o identificador do aparelho e, depois do primeiro envio, o aviso já foi visto', async () => {
    const { repository, device, service } = fakes()
    const report: NovoRelato = { tipo: 'chuva', subtipo: null, valores: { mm: 10 }, ...point, data_fato: TODAY }

    expect(service.noticeSeen()).toBe(false)
    await service.send(report)

    expect(repository.send).toHaveBeenCalledWith(report, 'aparelho-1234')
    expect(device.markNoticeSeen).toHaveBeenCalled()
    expect(service.noticeSeen()).toBe(true)
  })

  it('se o envio falhar, o aviso continua para a próxima vez', async () => {
    const { repository, device, service } = fakes()
    repository.send.mockRejectedValue(new ApiError('/api/comunidade/relatos', 429, 'TOO_MANY_REPORTS', 'POST'))

    await expect(service.send({} as NovoRelato)).rejects.toBeInstanceOf(ApiError)
    expect(device.markNoticeSeen).not.toHaveBeenCalled()
  })

  it('apaga o próprio relato com o identificador do aparelho', async () => {
    const { repository, service } = fakes()

    await service.remove('r1')

    expect(repository.remove).toHaveBeenCalledWith('r1', 'aparelho-1234')
  })

  it('pega a região pelo satélite no ponto da lavoura (P3)', async () => {
    const { regions, service } = fakes()
    const region = { raio_km: 30 } as RegiaoSatelite
    regions.get.mockResolvedValue(region)

    await expect(service.region({ lat: 1, lon: 2 }, 'en')).resolves.toBe(region)
    expect(regions.get).toHaveBeenCalledWith({ lat: 1, lon: 2 }, 'en')
  })
})

describe('datas dos relatos', () => {
  it('o dia de hoje no aparelho, em AAAA-MM-DD', () => {
    expect(isoDate(new Date(2026, 10, 5, 23, 30))).toBe('2026-11-05')
  })

  it('soma e tira dias sem depender do fuso', () => {
    expect(addDays('2026-11-15', -30)).toBe('2026-10-16')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('chuva e evento: de 30 dias atrás até hoje', () => {
    expect(dateBounds(TODAY)).toEqual({ min: '2026-10-16', max: TODAY })
  })
})

describe('plantingReport ("O que plantei depois da soja")', () => {
  it('cultura, ano e como foi viram o relato de plantio, sem data do fato', () => {
    expect(plantingReport({ crop: 'milheto', year: 2026, outcome: 'bem', reason: null }, point)).toEqual({
      tipo: 'plantio',
      subtipo: 'milheto',
      valores: { ano: 2026, resultado: 'bem' },
      lat: point.lat,
      lon: point.lon,
      data_fato: null,
    })
  })

  it('se perdeu, precisa do motivo', () => {
    expect(plantingReport({ crop: 'sorgo', year: 2026, outcome: 'perdi', reason: null }, point)).toBeNull()
    expect(plantingReport({ crop: 'sorgo', year: 2026, outcome: 'perdi', reason: 'seca' }, point)?.valores).toEqual({
      ano: 2026,
      resultado: 'perdi',
      motivo: 'seca',
    })
  })

  it('o motivo só vai quando perdeu', () => {
    expect(plantingReport({ crop: 'sorgo', year: 2026, outcome: 'bem', reason: 'seca' }, point)?.valores).toEqual({
      ano: 2026,
      resultado: 'bem',
    })
  })

  it('"deixei parado" não pergunta como foi', () => {
    expect(plantingReport({ crop: 'pousio', year: 2025, outcome: null, reason: null }, point)?.valores).toEqual({ ano: 2025 })
    expect(plantingReport({ crop: 'pousio', year: 2025, outcome: 'bem', reason: null }, point)?.valores).toEqual({ ano: 2025 })
  })

  it('falta a cultura, o ano ou como foi: ainda não dá para enviar', () => {
    expect(plantingReport({ crop: null, year: 2026, outcome: 'bem', reason: null }, point)).toBeNull()
    expect(plantingReport({ crop: 'milheto', year: null, outcome: 'bem', reason: null }, point)).toBeNull()
    expect(plantingReport({ crop: 'milheto', year: 2026, outcome: null, reason: null }, point)).toBeNull()
  })
})

describe('rainReport ("Choveu aqui")', () => {
  it('milímetros (com vírgula ou ponto) e a data', () => {
    expect(rainReport({ mm: '12,5', date: TODAY }, point, TODAY)).toEqual({
      tipo: 'chuva',
      subtipo: null,
      valores: { mm: 12.5 },
      lat: point.lat,
      lon: point.lon,
      data_fato: TODAY,
    })
    expect(rainReport({ mm: '0', date: TODAY }, point, TODAY)?.valores).toEqual({ mm: 0 })
  })

  it('de 0 a 300 mm, e só número', () => {
    for (const mm of ['', '-1', '300.5', 'muito', '1e3']) {
      expect(rainReport({ mm, date: TODAY }, point, TODAY)).toBeNull()
    }
    expect(rainReport({ mm: '300', date: TODAY }, point, TODAY)?.valores).toEqual({ mm: 300 })
  })

  it('data não futura e de no máximo 30 dias atrás', () => {
    expect(rainReport({ mm: '10', date: '2026-11-16' }, point, TODAY)).toBeNull()
    expect(rainReport({ mm: '10', date: '2026-10-15' }, point, TODAY)).toBeNull()
    expect(rainReport({ mm: '10', date: '2026-10-16' }, point, TODAY)?.data_fato).toBe('2026-10-16')
    expect(rainReport({ mm: '10', date: '' }, point, TODAY)).toBeNull()
  })
})

describe('eventReport ("Aconteceu aqui")', () => {
  it('o que aconteceu e a data', () => {
    expect(eventReport({ event: 'fogo', date: TODAY }, point, TODAY)).toEqual({
      tipo: 'evento',
      subtipo: 'fogo',
      valores: {},
      lat: point.lat,
      lon: point.lon,
      data_fato: TODAY,
    })
  })

  it('sem o evento ou com data fora da janela, não envia', () => {
    expect(eventReport({ event: null, date: TODAY }, point, TODAY)).toBeNull()
    expect(eventReport({ event: 'geada', date: '2026-11-16' }, point, TODAY)).toBeNull()
  })
})

describe('nearbySummary ("Perto de você")', () => {
  it('plantio: a safra mais recente com relatos, quantos de cada cultura e quantos disseram que foi bem', () => {
    const summary = nearbySummary(
      vizinhos([
        relato({ tipo: 'plantio', subtipo: 'milheto', valores: { ano: 2026, resultado: 'bem' }, data_fato: null }),
        relato({ tipo: 'plantio', subtipo: 'milho_safrinha', valores: { ano: 2026, resultado: 'perdi' }, data_fato: null }),
        relato({ tipo: 'plantio', subtipo: 'milheto', valores: { ano: 2026, resultado: 'bem' }, data_fato: null }),
        relato({ tipo: 'plantio', subtipo: 'pousio', valores: { ano: 2026 }, data_fato: null }),
        relato({ tipo: 'plantio', subtipo: 'sorgo', valores: { ano: 2025, resultado: 'bem' }, data_fato: null }),
      ]),
      TODAY,
    )

    expect(summary.planting).toEqual({
      year: 2026,
      total: 4,
      crops: [
        { crop: 'milheto', count: 2 },
        { crop: 'milho_safrinha', count: 1 },
        { crop: 'pousio', count: 1 },
      ],
      wentWell: 2,
      example: false,
    })
  })

  it('chuva: média dos relatos dos últimos 7 dias e quantos são', () => {
    const summary = nearbySummary(
      vizinhos([
        relato({ valores: { mm: 20 }, data_fato: TODAY }),
        relato({ valores: { mm: 11 }, data_fato: '2026-11-09' }),
        relato({ valores: { mm: 90 }, data_fato: '2026-11-08' }), // 8 dias atrás: fica de fora
      ]),
      TODAY,
    )

    expect(summary.rain).toEqual({ averageMm: 15.5, count: 2, example: false })
  })

  it('eventos dos últimos 30 dias, do mais recente para o mais antigo', () => {
    const summary = nearbySummary(
      vizinhos([
        relato({ id: 'velho', tipo: 'evento', subtipo: 'granizo', data_fato: '2026-11-01' }),
        relato({ id: 'novo', tipo: 'evento', subtipo: 'fogo', data_fato: '2026-11-14', meu: true }),
        relato({ id: 'fora', tipo: 'evento', subtipo: 'geada', data_fato: '2026-10-10' }),
      ]),
      TODAY,
    )

    expect(summary.events.map((event) => [event.id, event.event, event.date, event.mine])).toEqual([
      ['novo', 'fogo', '2026-11-14', true],
      ['velho', 'granizo', '2026-11-01', false],
    ])
  })

  it('sem relatos: tudo vazio', () => {
    const summary = nearbySummary(vizinhos([]), TODAY)

    expect(summary).toEqual({ planting: null, rain: null, events: [], mine: [], empty: true })
  })

  it('marca o que vem dos dados de demonstração, para o selo "Exemplo"', () => {
    const summary = nearbySummary(
      vizinhos([
        relato({ valores: { mm: 20 }, exemplo: true }),
        relato({ tipo: 'evento', subtipo: 'vendaval', exemplo: true }),
        relato({ tipo: 'plantio', subtipo: 'milheto', valores: { ano: 2026, resultado: 'bem' }, data_fato: null, exemplo: true }),
      ]),
      TODAY,
    )

    expect(summary.rain?.example).toBe(true)
    expect(summary.planting?.example).toBe(true)
    expect(summary.events[0].example).toBe(true)
  })

  it('os meus relatos à parte (para apagar) e os tipos desconhecidos ignorados', () => {
    const mine = relato({ id: 'meu', meu: true, valores: { mm: 5 } })
    const summary = nearbySummary(vizinhos([mine, relato({ tipo: 'oferta', subtipo: 'trator' })]), TODAY)

    expect(summary.mine).toEqual([mine])
    expect(summary.empty).toBe(false)
  })
})

describe('cellMarkers (mapa da redondeza)', () => {
  it('agrupa os relatos por célula, contando cada tipo, no centro da célula', () => {
    const markers = cellMarkers([
      relato({ tipo: 'chuva' }),
      relato({ tipo: 'evento', subtipo: 'fogo' }),
      relato({ tipo: 'chuva' }),
      relato({ tipo: 'plantio', celula: '-189_-482', lat: -18.85, lon: -48.15, exemplo: true }),
      relato({ tipo: 'oferta', celula: '-180_-480' }),
    ])

    expect(markers).toEqual([
      { celula: '-190_-482', lat: -18.95, lon: -48.15, plantio: 0, chuva: 2, evento: 1, example: false },
      { celula: '-189_-482', lat: -18.85, lon: -48.15, plantio: 1, chuva: 0, evento: 0, example: true },
    ])
  })
})

describe('erros dos relatos', () => {
  it('o motivo do erro para a mensagem certa', () => {
    expect(reportErrorKind(new ApiError('/x', 429, 'TOO_MANY_REPORTS', 'POST'))).toBe('limit')
    expect(reportErrorKind(new ApiError('/x', 422, 'VALIDATION_ERROR', 'POST'))).toBe('invalid')
    expect(reportErrorKind(new ApiError('/x', 422, 'INVALID_REQUEST', 'POST'))).toBe('invalid')
    expect(reportErrorKind(new ApiError('/x', 503, 'COMMUNITY_UNAVAILABLE', 'POST'))).toBe('unavailable')
    expect(reportErrorKind(new Error('rede'))).toBe('other')
  })

  it('comunidade sem banco (503) ou sem endpoint (404 sem código): o bloco não aparece', () => {
    expect(isCommunityUnavailable(new ApiError('/x', 503, 'COMMUNITY_UNAVAILABLE'))).toBe(true)
    expect(isCommunityUnavailable(new ApiError('/x', 404, null))).toBe(true)
    expect(isCommunityUnavailable(new NotConnectedError('comunidade'))).toBe(true)
    expect(isCommunityUnavailable(new ApiError('/x', 500, null))).toBe(false)
  })
})

describe('regionSummary (P3)', () => {
  const region: RegiaoSatelite = {
    raio_km: 30,
    fonte: 'modis',
    anos: [
      { ano: 2023, pct_parado: 64, pct_plantou: 27, pct_incerto: 9 },
      { ano: 2024, pct_parado: 63, pct_plantou: 29, pct_incerto: 8 },
      { ano: 2025, pct_parado: 62, pct_plantou: 30, pct_incerto: 8 },
    ],
  }

  it('o último ano em destaque, a média da série e o quanto o satélite não conseguiu ver', () => {
    expect(regionSummary(region)).toEqual({
      last: { ano: 2025, pct: 62 },
      average: 63,
      uncertain: 8,
      bars: [
        { ano: 2023, pct: 64 },
        { ano: 2024, pct: 63 },
        { ano: 2025, pct: 62 },
      ],
    })
  })

  it('sem anos na série, não há o que mostrar', () => {
    expect(regionSummary({ ...region, anos: [] })).toBeNull()
  })
})

describe('regionPlace (P3): onde fica o círculo medido pelo satélite', () => {
  const region: RegiaoSatelite = { raio_km: 30, fonte: 'modis', anos: [] }

  it('com o centro a até 1 km da lavoura, o círculo é em volta dela (sem distância)', () => {
    expect(regionPlace({ ...region, distancia_km: 0 })).toEqual({ radiusKm: 30, distanceKm: null })
    expect(regionPlace({ ...region, distancia_km: 1 })).toEqual({ radiusKm: 30, distanceKm: null })
  })

  it('mais longe, diz a que distância da lavoura fica o centro do círculo', () => {
    expect(regionPlace({ ...region, distancia_km: 12.3 })).toEqual({ radiusKm: 30, distanceKm: 12.3 })
  })

  it('API antiga, sem distancia_km: como se o círculo fosse em volta da lavoura', () => {
    expect(regionPlace(region)).toEqual({ radiusKm: 30, distanceKm: null })
    expect(regionPlace({ ...region, distancia_km: null })).toEqual({ radiusKm: 30, distanceKm: null })
  })
})
