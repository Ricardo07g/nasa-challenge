import { describe, expect, it } from 'vitest'
import type { SojaRecente, Talhao } from '../models/talhao'
import { recentSoyWarning } from './recentSoyService'

/** Valores de teste (não são do MODIS). */
function talhao(soja_recente?: SojaRecente | null): Partial<Talhao> {
  return soja_recente === undefined ? {} : { soja_recente }
}

const SOJA: SojaRecente = { safra: '2025/26', vista: false, ndvi_pico: 0.41, fonte: 'teste' }

describe('recentSoyWarning (RF-24)', () => {
  it('avisa quando o satélite não viu soja no ponto na última safra, com a safra da API', () => {
    expect(recentSoyWarning(talhao(SOJA) as Talhao)).toEqual({ safra: '2025/26' })
    expect(recentSoyWarning(talhao({ ...SOJA, safra: '2026/27' }) as Talhao)).toEqual({ safra: '2026/27' })
  })

  it('não avisa quando viu soja', () => {
    expect(recentSoyWarning(talhao({ ...SOJA, vista: true, ndvi_pico: 0.86 }) as Talhao)).toBeNull()
  })

  it('não avisa sem o dado do pixel (nuvem) nem fora da área medida', () => {
    expect(recentSoyWarning(talhao({ ...SOJA, vista: null, ndvi_pico: null }) as Talhao)).toBeNull()
    expect(recentSoyWarning(talhao(null) as Talhao)).toBeNull()
  })

  it('não avisa com a API antiga (sem o campo) nem sem talhão', () => {
    expect(recentSoyWarning(talhao() as Talhao)).toBeNull()
    expect(recentSoyWarning(undefined)).toBeNull()
  })
})
