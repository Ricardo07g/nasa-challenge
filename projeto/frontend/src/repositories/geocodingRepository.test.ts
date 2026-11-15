import { describe, expect, it, vi } from 'vitest'
import type { PhotonResponse } from '../models/place'
import { createPhotonGeocodingRepository } from './geocodingRepository'
import { createMockGeocodingRepository } from './mocks/mockLocation'

/** Resposta real do Photon (15/11/2026), encurtada: /reverse perto da lavoura de demonstração. */
const REVERSE_RESPONSE: PhotonResponse = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        osm_type: 'N',
        osm_id: 3046612095,
        osm_key: 'place',
        osm_value: 'farm',
        type: 'locality',
        name: 'Fazenda Maria Dória',
        city: 'Uberlândia',
        state: 'Minas Gerais',
        country: 'Brasil',
        countrycode: 'BR',
      },
      geometry: { type: 'Point', coordinates: [-48.1922238, -18.9572458] },
    },
  ],
}

function stubFetch(body: unknown = REVERSE_RESPONSE) {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(body))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function calledUrl(fetchMock: ReturnType<typeof vi.fn>): URL {
  return new URL(fetchMock.mock.calls[0][0] as string)
}

describe('geocodingRepository (Photon, OpenStreetMap, sem chave): só o endereço aproximado', () => {
  it('endereço aproximado do ponto: /reverse com lat, lon e um lugar só, com o sinal para cancelar', async () => {
    const fetchMock = stubFetch()
    const controller = new AbortController()

    const data = await createPhotonGeocodingRepository().reverse(
      { lat: -18.9543, lon: -48.1993 },
      { lang: 'en', signal: controller.signal },
    )

    const url = calledUrl(fetchMock)
    expect(`${url.origin}${url.pathname}`).toBe('https://photon.komoot.io/reverse')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lat: '-18.9543',
      lon: '-48.1993',
      lang: 'en',
      limit: '1',
    })
    expect(fetchMock.mock.calls[0][1]).toEqual({ signal: controller.signal })
    expect(data).toEqual(REVERSE_RESPONSE)
  })

  it('o Photon não tem português: em pt pede os nomes locais (lang=default), que no Brasil já são em português', async () => {
    const fetchMock = stubFetch()

    await createPhotonGeocodingRepository().reverse({ lat: -18.9543, lon: -48.1993 }, { lang: 'pt' })

    expect(calledUrl(fetchMock).searchParams.get('lang')).toBe('default')
  })

  it('erro do Photon (ex.: limite de uso) chega como erro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })))

    await expect(
      createPhotonGeocodingRepository().reverse({ lat: -18.9543, lon: -48.1993 }, { lang: 'pt' }),
    ).rejects.toThrow('429')
  })
})

describe('geocodingRepository de exemplo (VITE_API_MODE=mock, sem rede)', () => {
  it('o endereço aproximado é a cidade de exemplo mais perto', async () => {
    const data = await createMockGeocodingRepository(0).reverse({ lat: -19.74, lon: -47.93 }, { lang: 'pt' })

    expect(data.features[0].properties).toMatchObject({ name: 'Uberaba', state: 'Minas Gerais' })
  })

  it('não tem mais a busca por endereço (saiu da tela, tarefa 0053)', () => {
    expect('search' in createMockGeocodingRepository(0)).toBe(false)
    expect('search' in createPhotonGeocodingRepository()).toBe(false)
  })
})
