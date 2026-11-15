import type { MetodoRegras } from '../models/metodo'
import { metodoRepository as defaultRepository } from '../repositories'
import type { MetodoRepository } from '../repositories/metodoRepository'

export type MethodRulesService = { get(): Promise<MetodoRegras | null> }

/**
 * Os números das regras do `regras.yaml` (`GET /api/metodo`, tarefa 0049), para as telas nunca repetirem
 * número de regra (ex.: os 35 °C do "deu certo" na tela 2). Um pedido por visita; sem a rota (API antiga) ou
 * com falha, null (o texto fica sem o número) e o próximo pedido tenta de novo.
 */
export function createMethodRulesService(repository: MetodoRepository = defaultRepository): MethodRulesService {
  let cached: Promise<MetodoRegras> | null = null
  return {
    get() {
      cached ??= repository.get().catch((error: unknown) => {
        cached = null
        throw error
      })
      return cached.catch(() => null)
    },
  }
}

export const methodRulesService = createMethodRulesService()
