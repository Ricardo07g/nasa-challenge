import { useI18n } from '../i18n/useI18n'
import { EXAMPLE_FARM } from '../models/area'
import { farmService, type FarmService } from '../services/farmService'
import { buildFlowQuery } from '../services/flowParams'
import { useAsync } from './useAsync'

type Deps = { farm: FarmService }

const defaultDeps: Deps = { farm: farmService }

/** Faixa do motor quando o satélite não sugere nenhuma (a mesma do `colheita` padrão do backend). */
const DEFAULT_HARVEST = 'meio'

/**
 * "Ver um exemplo pronto" (tarefa 0049): abre a resposta da fazenda de exemplo com a faixa de colheita do
 * satélite, a mesma que o `/exemplo` usa na recomendação (antes, a URL dizia `meio` e a resposta era da faixa
 * do satélite). Sem a faixa ou com falha, o meio de fevereiro.
 */
export function useExampleController(deps: Deps = defaultDeps): { to: string | null } {
  const { lang } = useI18n()
  const talhao = useAsync(() => deps.farm.talhao({ ...EXAMPLE_FARM, exemplo: true }, lang), [lang])
  if (talhao.status === 'loading') return { to: null }
  const colheita = talhao.data?.colheita_sugerida?.faixa ?? DEFAULT_HARVEST
  return { to: `/resposta${buildFlowQuery({ ...EXAMPLE_FARM, colheita, exemplo: true })}` }
}
