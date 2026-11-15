import { describe, expect, it, vi } from 'vitest'
import type { Aviso, Avisos } from '../models/avisos'
import { buildAvisos } from '../repositories/mocks/mockAvisos'
import type { SavedPointRepository } from '../repositories/savedPointRepository'
import {
  alertGroups,
  alertsPoint,
  createAvisosService,
  explorerLink,
  headerCount,
  isWorse,
  pointFromFlow,
} from './avisosService'

const POINT = { lat: -18.9543, lon: -48.1993, colheita: 'meio' as const }

function savedPoints(initial: SavedPointRepository['get'] extends () => infer P ? P : never = null) {
  let point = initial
  return { get: vi.fn(() => point), save: vi.fn((p) => (point = p)) } satisfies SavedPointRepository
}

function aviso(tipo: string, valores: Aviso['valores']): Aviso {
  return { tipo, nivel: 'fique_de_olho', fontes: ['gpm_imerg'], data: '2024-07-30', antiga: false, valores }
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

  it('o ponto do fluxo vale para os avisos, menos a fazenda de exemplo', () => {
    expect(pointFromFlow(null)).toBeNull()
    expect(pointFromFlow({ lat: -18.9, lon: -48.2, exemplo: true, colheita: 'meio' })).toBeNull()
    expect(
      pointFromFlow({ lat: -18.9, lon: -48.2, exemplo: false, colheita: 'tarde', solo: 'arenoso', confirmadas: '2025:parado' }),
    ).toEqual({ lat: -18.9, lon: -48.2, colheita: 'tarde', solo: 'arenoso', confirmadas: '2025:parado' })
    expect(pointFromFlow({ lat: -18.9, lon: -48.2, exemplo: false, confirmadas: '' })).toEqual({ lat: -18.9, lon: -48.2 })
  })

  it('o ponto da URL vem antes do salvo; sem nenhum, não há avisos', () => {
    const saved = { lat: -19.5, lon: -48.9 }

    expect(alertsPoint(POINT, saved)).toBe(POINT)
    expect(alertsPoint(null, saved)).toBe(saved)
    expect(alertsPoint(null, null)).toBeNull()
  })

  it('os grupos na ordem do pedido, sem os que não têm dado', () => {
    const avisos: Avisos = { ...buildAvisos(POINT, 'pt'), mudou: null }

    expect(alertGroups(avisos).map((g) => g.key)).toEqual(['agora', 'recordes', 'perto'])
  })

  it('o link do ano abre o detalhe do ano na resposta, com os parâmetros do ponto', () => {
    expect(explorerLink({ ...POINT, confirmadas: '2025:parado' }, 2024)).toBe(
      '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio&confirmadas=2025:parado&ano=2024',
    )
    expect(explorerLink({ lat: -18.9, lon: -48.2 }, 2024)).toBe('/resposta?lat=-18.9&lon=-48.2&ano=2024')
  })

  it('o botão do cabeçalho só mostra número com aviso ativo', () => {
    expect(headerCount(buildAvisos(POINT, 'pt'))).toBe(2)
    expect(headerCount({ ...buildAvisos(POINT, 'pt'), contador: 0 })).toBeNull()
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
