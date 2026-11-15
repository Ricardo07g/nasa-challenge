import { describe, expect, it, vi } from 'vitest'
import { ApiError, NotConnectedError, getExternalJson, getJson, isNotConnected, isOutsideArea } from './httpClient'

describe('getJson', () => {
  it('faz GET no caminho e devolve o JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)

    const data = await getJson<{ status: string }>('/api/health')

    expect(fetchMock).toHaveBeenCalledWith('/api/health')
    expect(data).toEqual({ status: 'ok' })
  })

  it('pede os textos no idioma da interface (Accept-Language)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({}))
    vi.stubGlobal('fetch', fetchMock)

    await getJson('/api/recomendacao', { lang: 'en' })

    expect(fetchMock).toHaveBeenCalledWith('/api/recomendacao', { headers: { 'Accept-Language': 'en' } })
  })

  it('lança erro quando a resposta não é 2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

    await expect(getJson('/api/health')).rejects.toThrow('500')
  })
})

describe('ApiError', () => {
  it('guarda o status e o código do erro da API (problem+json)', async () => {
    const body = { status: 404, code: 'OUTSIDE_AREA', detail: 'Ainda não temos dados preparados para esse ponto.' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status: 404 })))

    const error = await getJson('/api/recomendacao').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, code: 'OUTSIDE_AREA' })
    expect(isOutsideArea(error)).toBe(true)
  })

  it('erro sem corpo JSON fica sem código e não conta como fora da área', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('quebrou', { status: 500 })))

    const error = await getJson('/api/recomendacao').catch((e: unknown) => e)

    expect(error).toMatchObject({ status: 500, code: null })
    expect(isOutsideArea(error)).toBe(false)
    expect(isOutsideArea(new Error('rede'))).toBe(false)
  })
})

describe('isNotConnected (dado que a API ainda não manda)', () => {
  it('endpoint que ainda não existe no backend (404 sem código) não é falha: é "ainda não conectado"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: 'Not Found' }, { status: 404 })))

    const error = await getJson('/api/regiao?lat=-18.9&lon=-48.2').catch((e: unknown) => e)

    expect(isNotConnected(error)).toBe(true)
    expect(isOutsideArea(error)).toBe(false)
  })

  it('repository sem versão http (NotConnectedError) também é "ainda não conectado"', () => {
    expect(isNotConnected(new NotConnectedError('comunidade'))).toBe(true)
  })

  it('fora da área, erro do servidor ou da rede não contam como "ainda não conectado"', () => {
    expect(isNotConnected(new ApiError('/api/talhao', 404, 'OUTSIDE_AREA'))).toBe(false)
    expect(isNotConnected(new ApiError('/api/talhao', 500, null))).toBe(false)
    expect(isNotConnected(new Error('rede'))).toBe(false)
  })
})

describe('getExternalJson (serviço público de fora, sem chave: busca de endereço)', () => {
  it('faz GET na URL completa com o sinal para cancelar e devolve o JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ features: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    const data = await getExternalJson('https://photon.komoot.io/api/?q=uberaba', { signal: controller.signal })

    expect(fetchMock).toHaveBeenCalledWith('https://photon.komoot.io/api/?q=uberaba', { signal: controller.signal })
    expect(data).toEqual({ features: [] })
  })

  it('lança ApiError quando a resposta não é 2xx (ex.: limite de uso)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('devagar', { status: 429 })))

    const error = await getExternalJson('https://photon.komoot.io/api/?q=uberaba').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 429, code: null })
  })
})
