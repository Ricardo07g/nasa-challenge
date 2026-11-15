/**
 * Relatos de demonstração da comunidade (só com VITE_API_MODE=mock, desligado por padrão). Cada
 * exemplo vem com `exemplo: true` e a tela põe o selo "Exemplo" em cada um: nunca parecem relatos de
 * verdade. O que o aparelho envia fica só na memória da página.
 */
import type { NovoRelato, RelatoComunidade } from '../../models/community'
import type { CommunityRepository } from '../communityRepository'
import { delay } from './delay'

/** Id da célula de 0,1° como no backend (`cell_id_for`): floor de lat e lon × 10. */
function cellIndex(value: number): number {
  return Math.floor(Math.round(value * 10 * 1e6) / 1e6)
}

function cellOf(lat: number, lon: number, dLat = 0, dLon = 0) {
  const latIdx = cellIndex(lat) + dLat
  const lonIdx = cellIndex(lon) + dLon
  return { celula: `${latIdx}_${lonIdx}`, lat: (latIdx + 0.5) / 10, lon: (lonIdx + 0.5) / 10 }
}

function daysAgo(days: number): string {
  const day = new Date()
  day.setDate(day.getDate() - days)
  const month = String(day.getMonth() + 1).padStart(2, '0')
  return `${day.getFullYear()}-${month}-${String(day.getDate()).padStart(2, '0')}`
}

type Example = Omit<RelatoComunidade, 'id' | 'celula' | 'lat' | 'lon' | 'meu' | 'exemplo'> & {
  cell: [number, number]
}

const EXAMPLES: Example[] = [
  { tipo: 'plantio', subtipo: 'milho_braquiaria', valores: { ano: 2026, resultado: 'bem' }, data_fato: null, cell: [1, 0] },
  { tipo: 'plantio', subtipo: 'milho_braquiaria', valores: { ano: 2026, resultado: 'bem' }, data_fato: null, cell: [0, 1] },
  {
    tipo: 'plantio',
    subtipo: 'milho_braquiaria',
    valores: { ano: 2026, resultado: 'mais_ou_menos' },
    data_fato: null,
    cell: [-1, 1],
  },
  { tipo: 'plantio', subtipo: 'milheto', valores: { ano: 2026, resultado: 'bem' }, data_fato: null, cell: [1, -1] },
  { tipo: 'plantio', subtipo: 'milheto', valores: { ano: 2026, resultado: 'bem' }, data_fato: null, cell: [0, -2] },
  { tipo: 'plantio', subtipo: 'pousio', valores: { ano: 2026 }, data_fato: null, cell: [-2, 0] },
  {
    tipo: 'plantio',
    subtipo: 'sorgo',
    valores: { ano: 2026, resultado: 'perdi', motivo: 'seca' },
    data_fato: null,
    cell: [2, 1],
  },
  { tipo: 'chuva', subtipo: null, valores: { mm: 24 }, data_fato: daysAgo(1), cell: [1, 0] },
  { tipo: 'chuva', subtipo: null, valores: { mm: 18 }, data_fato: daysAgo(2), cell: [0, 1] },
  { tipo: 'chuva', subtipo: null, valores: { mm: 30 }, data_fato: daysAgo(5), cell: [-1, -1] },
  { tipo: 'evento', subtipo: 'granizo', valores: {}, data_fato: daysAgo(3), cell: [1, 1] },
  { tipo: 'evento', subtipo: 'enxurrada_erosao', valores: {}, data_fato: daysAgo(9), cell: [-1, 0] },
  { tipo: 'evento', subtipo: 'vendaval', valores: {}, data_fato: daysAgo(20), cell: [2, -1] },
]

export function createMockCommunityRepository(delayMs = 300): CommunityRepository {
  let sent: RelatoComunidade[] = []
  let next = 1
  return {
    async list(point) {
      await delay(delayMs)
      const examples = EXAMPLES.map(({ cell, ...example }, index): RelatoComunidade => ({
        ...example,
        ...cellOf(point.lat, point.lon, cell[0], cell[1]),
        id: `exemplo-${index + 1}`,
        meu: false,
        exemplo: true,
      }))
      return { raio_km: 30, anos_safra: [2024, 2025, 2026], relatos: [...sent, ...examples] }
    },
    async send(report: NovoRelato) {
      await delay(delayMs)
      const stored: RelatoComunidade = {
        id: `meu-${next++}`,
        tipo: report.tipo,
        subtipo: report.subtipo,
        valores: report.valores,
        data_fato: report.data_fato,
        ...cellOf(report.lat, report.lon),
        meu: true,
      }
      sent = [stored, ...sent]
      return stored
    },
    async remove(id) {
      await delay(delayMs)
      sent = sent.filter((report) => report.id !== id)
    },
  }
}
