import { describe, expect, it, vi } from 'vitest'
import { cropOptionRepository } from './cropOptionRepository'
import { healthRepository } from './healthRepository'

describe('repositories', () => {
  it('cropOptionRepository busca /api/crop-options', async () => {
    const options = [{ id: 'milheto', name: 'Milheto', role: 'Cobertura' }]
    const fetchMock = vi.fn().mockResolvedValue(Response.json(options))
    vi.stubGlobal('fetch', fetchMock)

    const result = await cropOptionRepository.listAll()

    expect(fetchMock).toHaveBeenCalledWith('/api/crop-options')
    expect(result).toEqual(options)
  })

  it('healthRepository busca /api/health', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await healthRepository.getHealth()

    expect(fetchMock).toHaveBeenCalledWith('/api/health')
    expect(result).toEqual({ status: 'ok' })
  })
})
