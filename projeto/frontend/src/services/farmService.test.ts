import { describe, expect, it, vi } from 'vitest'
import type { Exemplo, Recomendacao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import { createFarmService } from './farmService'

const talhao = { dentro_da_area: true } as Talhao
const recomendacao = { melhor: 'sorgo' } as Recomendacao
const exemplo = { talhao: { dentro_da_area: true, celula_id: 'ex' }, recomendacao: { melhor: 'milheto' } } as Exemplo

function fakes() {
  return {
    talhaoRepository: { get: vi.fn().mockResolvedValue(talhao) },
    recomendacaoRepository: { get: vi.fn().mockResolvedValue(recomendacao) },
    exemploRepository: { get: vi.fn().mockResolvedValue(exemplo) },
  }
}

describe('farmService', () => {
  it('busca o talhão uma vez só por ponto e idioma (a tela 2 aquece o cache das telas 3 e 4)', async () => {
    const deps = fakes()
    const service = createFarmService(deps)

    await service.talhao({ lat: -18.92, lon: -48.28 }, 'pt')
    await service.talhao({ lat: -18.92, lon: -48.28 }, 'pt')
    await service.talhao({ lat: -18.92, lon: -48.28 }, 'en')

    expect(deps.talhaoRepository.get).toHaveBeenCalledTimes(2)
  })

  it('não guarda no cache uma busca que falhou', async () => {
    const deps = fakes()
    deps.talhaoRepository.get.mockRejectedValueOnce(new Error('rede'))
    const service = createFarmService(deps)

    await expect(service.talhao({ lat: -18.92, lon: -48.28 }, 'pt')).rejects.toThrow('rede')
    await expect(service.talhao({ lat: -18.92, lon: -48.28 }, 'pt')).resolves.toBe(talhao)
  })

  it('busca a recomendação uma vez só por parâmetros', async () => {
    const deps = fakes()
    const service = createFarmService(deps)
    const params = { lat: -18.92, lon: -48.28, colheita: 'meio' as const }

    await service.recomendacao(params, 'pt')
    await service.recomendacao(params, 'pt')
    await service.recomendacao({ ...params, solo: 'argiloso' }, 'pt')

    expect(deps.recomendacaoRepository.get).toHaveBeenCalledTimes(2)
  })

  it('na fazenda de exemplo usa /exemplo, não o talhão nem a recomendação', async () => {
    const deps = fakes()
    const service = createFarmService(deps)

    const t = await service.talhao({ lat: -18.92, lon: -48.28, exemplo: true }, 'pt')
    const r = await service.recomendacao({ lat: -18.92, lon: -48.28, colheita: 'meio', exemplo: true }, 'pt')

    expect(t).toBe(exemplo.talhao)
    expect(r).toBe(exemplo.recomendacao)
    expect(deps.talhaoRepository.get).not.toHaveBeenCalled()
    expect(deps.recomendacaoRepository.get).not.toHaveBeenCalled()
    expect(deps.exemploRepository.get).toHaveBeenCalledTimes(1)
  })
})
