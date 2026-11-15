import { describe, expect, it, vi } from 'vitest'
import type { PhotonResponse } from '../models/place'
import { createPhotonGeocodingRepository } from './geocodingRepository'
import { createMockGeocodingRepository } from './mocks/mockLocation'

/** Resposta real do Photon (15/11/2026), encurtada: busca "rodovia br-050 uberaba". */
const SEARCH_RESPONSE: PhotonResponse = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        osm_type: 'W',
        osm_id: 1460357650,
        osm_key: 'highway',
        osm_value: 'motorway',
        type: 'street',
        name: 'Rodovia Chico Xavier',
        district: 'Setor Sul',
        city: 'Uberlândia',
        state: 'Minas Gerais',
        country: 'Brasil',
        countrycode: 'BR',
      },
      geometry: { type: 'Point', coordinates: [-48.2128481, -18.9808048] },
    },
  ],
}

function stubFetch(body: unknown = SEARCH_RESPONSE) {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(body))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function calledUrl(fetchMock: ReturnType<typeof vi.fn>): URL {
  return new URL(fetchMock.mock.calls[0][0] as string)
}

describe('geocodingRepository (Photon, OpenStreetMap, sem chave)', () => {
  it('busca no /api do Photon com o texto, no máximo 5 lugares e a preferência perto da área', async () => {
    const fetchMock = stubFetch()

    const data = await createPhotonGeocodingRepository().search('rodovia br-050 uberaba', {
      lang: 'en',
      near: { lat: -19.15, lon: -48.25 },
    })

    const url = calledUrl(fetchMock)
    expect(`${url.origin}${url.pathname}`).toBe('https://photon.komoot.io/api/')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'rodovia br-050 uberaba',
      limit: '5',
      lang: 'en',
      lat: '-19.15',
      lon: '-48.25',
    })
    expect(data).toEqual(SEARCH_RESPONSE)
  })

  it('o Photon não tem português: em pt pede os nomes locais (lang=default), que no Brasil já são em português', async () => {
    const fetchMock = stubFetch()

    await createPhotonGeocodingRepository().search('uberaba', { lang: 'pt' })

    expect(calledUrl(fetchMock).searchParams.get('lang')).toBe('default')
    expect(calledUrl(fetchMock).searchParams.has('lat')).toBe(false)
  })

  it('passa o sinal para cancelar a busca anterior', async () => {
    const fetchMock = stubFetch()
    const controller = new AbortController()

    await createPhotonGeocodingRepository().search('uberaba', { lang: 'pt', signal: controller.signal })

    expect(fetchMock.mock.calls[0][1]).toEqual({ signal: controller.signal })
  })

  it('endereço aproximado do ponto: /reverse com lat, lon e um lugar só', async () => {
    const fetchMock = stubFetch({ type: 'FeatureCollection', features: [] })
    const controller = new AbortController()

    await createPhotonGeocodingRepository().reverse(
      { lat: -18.9543, lon: -48.1993 },
      { lang: 'pt', signal: controller.signal },
    )

    const url = calledUrl(fetchMock)
    expect(`${url.origin}${url.pathname}`).toBe('https://photon.komoot.io/reverse')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lat: '-18.9543',
      lon: '-48.1993',
      lang: 'default',
      limit: '1',
    })
    expect(fetchMock.mock.calls[0][1]).toEqual({ signal: controller.signal })
  })

  it('erro do Photon (ex.: limite de uso) chega como erro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })))

    await expect(createPhotonGeocodingRepository().search('uberaba', { lang: 'pt' })).rejects.toThrow('429')
  })
})

describe('geocodingRepository de exemplo (VITE_API_MODE=mock, sem rede)', () => {
  it('acha cidades da região pelo nome, sem acento nem caixa', async () => {
    const data = await createMockGeocodingRepository(0).search('uberla', { lang: 'pt' })

    expect(data.features.map((feature) => feature.properties.name)).toEqual(['Uberlândia'])
    expect(data.features[0].geometry.coordinates).toEqual([-48.277, -18.918])
  })

  it('o endereço aproximado é a cidade de exemplo mais perto', async () => {
    const data = await createMockGeocodingRepository(0).reverse({ lat: -19.74, lon: -47.93 }, { lang: 'pt' })

    expect(data.features[0].properties).toMatchObject({ name: 'Uberaba', state: 'Minas Gerais' })
  })
})
