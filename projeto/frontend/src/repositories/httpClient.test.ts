import { describe, expect, it, vi } from 'vitest'
import { getJson } from './httpClient'

describe('getJson', () => {
  it('faz GET no caminho e devolve o JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    const data = await getJson<{ status: string }>('/api/health')

    expect(fetchMock).toHaveBeenCalledWith('/api/health')
    expect(data).toEqual({ status: 'ok' })
  })

  it('lança erro quando a resposta não é 2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

    await expect(getJson('/api/health')).rejects.toThrow('500')
  })
})
