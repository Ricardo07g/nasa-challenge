/**
 * Ponto dos avisos (tela "Avisos", tarefa 0046 do backend): o último ponto marcado no fluxo, fora a
 * fazenda de exemplo, guardado no `localStorage` do aparelho. Sem cadastro e sem servidor: o ponto não sai
 * do aparelho, a não ser no pedido dos avisos.
 *
 * O `localStorage` pode falhar (janela anônima, dados do site bloqueados): toda leitura e escrita fica em
 * try/catch, e aí o ponto vale só para esta visita.
 */
import type { PontoAvisos } from '../models/avisos'
import { COLHEITAS, TEXTURAS, type Colheita, type Textura } from '../models/talhao'

export type SavedPointRepository = {
  get(): PontoAvisos | null
  save(point: PontoAvisos): void
}

const POINT_KEY = 'raiz-orbital.avisos.ponto'

function browserStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

/** Lê o ponto guardado; qualquer coisa fora do formato vira "sem ponto" (ou perde o campo estragado). */
function parsePoint(raw: string | null): PontoAvisos | null {
  if (!raw) return null
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  const item = value as Record<string, unknown> | null
  if (!item || typeof item.lat !== 'number' || typeof item.lon !== 'number') return null
  if (!Number.isFinite(item.lat) || !Number.isFinite(item.lon)) return null
  const point: PontoAvisos = { lat: item.lat, lon: item.lon }
  if (COLHEITAS.includes(item.colheita as Colheita)) point.colheita = item.colheita as Colheita
  if (TEXTURAS.includes(item.solo as Textura)) point.solo = item.solo as Textura
  if (typeof item.confirmadas === 'string' && /^[0-9a-z:,_]+$/.test(item.confirmadas)) {
    point.confirmadas = item.confirmadas
  }
  // Pacote 2 (tarefa 0054): a data da colheita, as respostas das safras e a escolha atual. Aqui só o formato
  // seguro; quem lê os valores é o `seasonAnswersService`.
  if (typeof item.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.data)) point.data = item.data
  if (typeof item.safras === 'string' && /^[0-9a-z:,_]+$/.test(item.safras)) point.safras = item.safras
  if (typeof item.pensa === 'string' && /^[a-z_]+$/.test(item.pensa)) point.pensa = item.pensa as PontoAvisos['pensa']
  return point
}

export function createLocalSavedPointRepository(
  storage: () => Storage | null = browserStorage,
): SavedPointRepository {
  let memory: PontoAvisos | null = null

  return {
    get() {
      try {
        const store = storage()
        if (store) return parsePoint(store.getItem(POINT_KEY))
      } catch {
        // Sem localStorage: fica o ponto desta visita.
      }
      return memory
    },
    save(point) {
      memory = { ...point }
      try {
        storage()?.setItem(POINT_KEY, JSON.stringify(point))
      } catch {
        // Sem localStorage: o ponto vale só para esta visita.
      }
    },
  }
}

export const savedPointRepository = createLocalSavedPointRepository()
