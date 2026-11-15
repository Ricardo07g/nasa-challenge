import { describe, expect, it, vi } from 'vitest'
import type { CustoAtraso, CustoFaixa } from '../models/custoAtraso'
import type { CustoAtrasoRepository } from '../repositories/custoAtrasoRepository'
import { createDelayCostService, delayCost } from './delayCostService'

/** Resultados de teste do motor (não são de dado real). */
const band = (colheita: CustoFaixa['colheita'], melhor: string | null, anos_bons: number | null): CustoFaixa => ({
  colheita,
  semeadura: '2027-02-18',
  melhor,
  nome: melhor,
  anos_bons,
  total_anos: melhor ? 20 : null,
})

const CUSTO: CustoAtraso = {
  faixas: [band('cedo', 'milho_braquiaria', 18), band('meio', 'milho_braquiaria', 16), band('tarde', 'milheto', 20)],
  mesma_cultura: false,
}

describe('delayCost (custo do atraso, tela 3)', () => {
  it('uma linha por faixa, na ordem, com a melhor opção do motor e os anos em que deu certo', () => {
    expect(delayCost(CUSTO)).toEqual({
      bands: [
        { band: 'cedo', crop: 'milho_braquiaria', good: 18, total: 20 },
        { band: 'meio', crop: 'milho_braquiaria', good: 16, total: 20 },
        { band: 'tarde', crop: 'milheto', good: 20, total: 20 },
      ],
      sameCrop: false,
    })
  })

  it('diz quando a melhor opção é a mesma nas três faixas', () => {
    const same = { ...CUSTO, faixas: CUSTO.faixas.map((f) => ({ ...f, melhor: 'milheto' })), mesma_cultura: true }

    expect(delayCost(same)?.sameCrop).toBe(true)
  })

  it('a faixa sem opção na janela de plantio fica de fora', () => {
    const custo = { ...CUSTO, faixas: [CUSTO.faixas[0], CUSTO.faixas[1], band('tarde', null, null)] }

    expect(delayCost(custo)?.bands.map((b) => b.band)).toEqual(['cedo', 'meio'])
  })

  it('sem nenhuma faixa com opção, ou sem o dado, nada aparece', () => {
    expect(delayCost({ faixas: [band('cedo', null, null)], mesma_cultura: false })).toBeNull()
    expect(delayCost(undefined)).toBeNull()
  })
})

describe('createDelayCostService', () => {
  it('pede ao repository o custo do ponto, com o idioma', async () => {
    const repository: CustoAtrasoRepository = { get: vi.fn().mockResolvedValue(CUSTO) }

    const custo = await createDelayCostService(repository).get({ lat: -18.9543, lon: -48.1993, solo: 'medio' }, 'en')

    expect(custo).toBe(CUSTO)
    expect(repository.get).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, solo: 'medio' }, 'en')
  })
})
