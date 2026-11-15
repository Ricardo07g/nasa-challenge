import { describe, expect, it, vi } from 'vitest'
import type { NovoRelato } from '../models/community'
import { createHttpCommunityRepository } from './communityRepository'
import { createMockCommunityRepository } from './mocks/mockCommunity'

const point = { lat: -18.9543, lon: -48.1993 }
const device = 'a1b2c3d4-e5f6-4789-8abc-def012345678'
const rain: NovoRelato = { tipo: 'chuva', subtipo: null, valores: { mm: 32 }, ...point, data_fato: '2026-11-15' }

describe('communityRepository (relatos da comunidade, tarefa 0047)', () => {
  it('lista os relatos em volta do ponto, com o aparelho no cabeçalho', async () => {
    const getJson = vi.fn().mockResolvedValue({ raio_km: 30, anos_safra: [2024], relatos: [] })

    await createHttpCommunityRepository(getJson, vi.fn()).list(point, device, 'pt')

    expect(getJson).toHaveBeenCalledWith('/api/comunidade/relatos?lat=-18.9543&lon=-48.1993', {
      lang: 'pt',
      headers: { 'X-Aparelho': device },
    })
  })

  it('envia o relato em POST com o aparelho no cabeçalho', async () => {
    const sendJson = vi.fn().mockResolvedValue({ id: 'r1' })

    const sent = await createHttpCommunityRepository(vi.fn(), sendJson).send(rain, device)

    expect(sendJson).toHaveBeenCalledWith('POST', '/api/comunidade/relatos', rain, { headers: { 'X-Aparelho': device } })
    expect(sent).toEqual({ id: 'r1' })
  })

  it('apaga o próprio relato em DELETE', async () => {
    const sendJson = vi.fn().mockResolvedValue(null)

    await createHttpCommunityRepository(vi.fn(), sendJson).remove('r 1', device)

    expect(sendJson).toHaveBeenCalledWith('DELETE', '/api/comunidade/relatos/r%201', undefined, {
      headers: { 'X-Aparelho': device },
    })
  })
})

describe('mockCommunityRepository (dados de demonstração, só com VITE_API_MODE=mock)', () => {
  it('cada relato de exemplo vem marcado como exemplo, em volta do ponto', async () => {
    const data = await createMockCommunityRepository(0).list(point, device, 'pt')

    expect(data.raio_km).toBe(30)
    expect(data.anos_safra).toEqual([2024, 2025, 2026])
    expect(data.relatos.length).toBeGreaterThan(0)
    expect(data.relatos.every((relato) => relato.exemplo === true && !relato.meu)).toBe(true)
    expect(data.relatos.every((relato) => Math.abs(relato.lat - point.lat) < 0.3)).toBe(true)
  })

  it('o relato enviado aparece como meu (sem selo de exemplo) e pode ser apagado', async () => {
    const repository = createMockCommunityRepository(0)

    const sent = await repository.send(rain, device)
    const listed = await repository.list(point, device, 'pt')
    await repository.remove(sent.id, device)
    const after = await repository.list(point, device, 'pt')

    expect(sent).toMatchObject({ tipo: 'chuva', meu: true, celula: '-190_-482', lat: -18.95, lon: -48.15 })
    expect(sent.exemplo).toBeUndefined()
    expect(listed.relatos.filter((relato) => relato.meu)).toHaveLength(1)
    expect(after.relatos.filter((relato) => relato.meu)).toHaveLength(0)
  })
})
