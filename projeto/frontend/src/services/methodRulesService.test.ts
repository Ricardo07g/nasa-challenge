import { describe, expect, it, vi } from 'vitest'
import type { MetodoRegras } from '../models/metodo'
import { createMethodRulesService } from './methodRulesService'

const RULES = { deu_certo: { calor_temp_c: 35 } } as MetodoRegras

describe('methodRulesService (números das regras, GET /api/metodo)', () => {
  it('pede uma vez por visita: as regras não mudam', async () => {
    const repository = { get: vi.fn().mockResolvedValue(RULES) }
    const service = createMethodRulesService(repository)

    await expect(service.get()).resolves.toBe(RULES)
    await expect(service.get()).resolves.toBe(RULES)
    expect(repository.get).toHaveBeenCalledTimes(1)
  })

  it('sem a rota (API antiga) ou com falha, null: o texto fica sem o número, e tenta de novo depois', async () => {
    const repository = { get: vi.fn().mockRejectedValueOnce(new Error('404')).mockResolvedValue(RULES) }
    const service = createMethodRulesService(repository)

    await expect(service.get()).resolves.toBeNull()
    await expect(service.get()).resolves.toBe(RULES)
    expect(repository.get).toHaveBeenCalledTimes(2)
  })
})
