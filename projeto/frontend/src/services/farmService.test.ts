import { describe, expect, it, vi } from 'vitest'
import type { Exemplo, Recomendacao } from '../models/recomendacao'
import type { Talhao } from '../models/talhao'
import { createFarmService } from './farmService'

const talhao = { dentro_da_area: true } as Talhao
const recomendacao = { melhor: 'sorgo' } as Recomendacao
const exemplo = {
  talhao: { dentro_da_area: true, celula_id: 'ex' },
  recomendacao: { melhor: 'milheto', entrada: { colheita: 'tarde' } },
} as Exemplo

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

  it('as safras confirmadas mudam a recomendação: cada combinação tem a sua (tarefa 0039)', async () => {
    const deps = fakes()
    const service = createFarmService(deps)
    const params = { lat: -18.92, lon: -48.28, colheita: 'meio' as const }

    await service.recomendacao(params, 'pt')
    await service.recomendacao({ ...params, confirmadas: '2025:parado' }, 'pt')
    await service.recomendacao({ ...params, confirmadas: '2025:parado' }, 'pt')

    expect(deps.recomendacaoRepository.get).toHaveBeenCalledTimes(2)
    expect(deps.recomendacaoRepository.get).toHaveBeenLastCalledWith({ ...params, confirmadas: '2025:parado' }, 'pt')
  })

  it('na fazenda de exemplo com safra confirmada, a recomendação vem da API com a confirmação', async () => {
    const deps = fakes()
    const service = createFarmService(deps)

    const r = await service.recomendacao(
      { lat: -18.9543, lon: -48.1993, colheita: 'meio', exemplo: true, confirmadas: '2026:plantou' },
      'pt',
    )

    expect(r).toBe(recomendacao)
    expect(deps.recomendacaoRepository.get).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, colheita: 'meio', confirmadas: '2026:plantou' },
      'pt',
    )
  })

  it('na fazenda de exemplo usa /exemplo, não o talhão nem a recomendação', async () => {
    const deps = fakes()
    const service = createFarmService(deps)

    const t = await service.talhao({ lat: -18.92, lon: -48.28, exemplo: true }, 'pt')
    const r = await service.recomendacao({ lat: -18.92, lon: -48.28, colheita: 'tarde', exemplo: true }, 'pt')

    expect(t).toBe(exemplo.talhao)
    expect(r).toBe(exemplo.recomendacao)
    expect(deps.talhaoRepository.get).not.toHaveBeenCalled()
    expect(deps.recomendacaoRepository.get).not.toHaveBeenCalled()
    expect(deps.exemploRepository.get).toHaveBeenCalledTimes(1)
  })

  it('na fazenda de exemplo com outra faixa na URL, a recomendação vem da API com essa faixa (tarefa 0049)', async () => {
    // O /exemplo responde com a faixa do satélite; se a URL diz outra (o produtor trocou na tela 3),
    // a resposta pronta falaria de outra colheita.
    const deps = fakes()
    const service = createFarmService(deps)

    const r = await service.recomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'meio', exemplo: true }, 'pt')

    expect(r).toBe(recomendacao)
    expect(deps.recomendacaoRepository.get).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')
  })

  it('na fazenda de exemplo com a terra trocada, a recomendação vem da API com a terra da URL', async () => {
    const deps = fakes()
    const service = createFarmService(deps)

    await service.recomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'tarde', solo: 'arenoso', exemplo: true }, 'pt')

    expect(deps.recomendacaoRepository.get).toHaveBeenCalledWith(
      { lat: -18.9543, lon: -48.1993, colheita: 'tarde', solo: 'arenoso' },
      'pt',
    )
  })
})
