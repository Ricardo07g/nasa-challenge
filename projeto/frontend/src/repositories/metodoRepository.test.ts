import { describe, expect, it, vi } from 'vitest'
import { createHttpMetodoRepository } from './metodoRepository'
import { createMockMetodoRepository } from './mocks/mockMetodo'

describe('metodoRepository (regras da tela "Como a conta é feita", tarefa 0049)', () => {
  it('http chama /api/metodo (os números ficam só no regras.yaml do backend)', async () => {
    const getJson = vi.fn().mockResolvedValue({ deu_certo: {} })

    await expect(createHttpMetodoRepository(getJson).get()).resolves.toEqual({ deu_certo: {} })
    expect(getJson).toHaveBeenCalledWith('/api/metodo')
  })

  it('dados de exemplo no formato do contrato', async () => {
    const rules = await createMockMetodoRepository().get()

    expect(Object.keys(rules).sort()).toEqual(['agua', 'alertas', 'avisos', 'deu_certo', 'pesos', 'plano_b', 'renda', 'rotacao', 'sinal'])
  })
})
