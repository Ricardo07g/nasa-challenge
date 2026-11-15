import { describe, expect, it, vi } from 'vitest'
import type { PhotonFeature, PhotonResponse } from '../models/place'
import type { GeocodingRepository } from '../repositories/geocodingRepository'
import { createGeocodingService, MIN_SEARCH_LENGTH, SEARCH_DELAY_MS } from './geocodingService'

const feature = (properties: PhotonFeature['properties'], lon = -48.2, lat = -18.9): PhotonFeature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates: [lon, lat] },
})

const response = (...features: PhotonFeature[]): PhotonResponse => ({ type: 'FeatureCollection', features })

function fakeRepository(data: PhotonResponse = response()) {
  return {
    search: vi.fn().mockResolvedValue(data),
    reverse: vi.fn().mockResolvedValue(data),
  } satisfies GeocodingRepository
}

describe('geocodingService: regras de uso do Photon', () => {
  it('espera 400 ms entre teclas e só busca com 3 letras ou mais', () => {
    const service = createGeocodingService(fakeRepository())

    expect(SEARCH_DELAY_MS).toBe(400)
    expect(MIN_SEARCH_LENGTH).toBe(3)
    expect(service.canSearch('ub')).toBe(false)
    expect(service.canSearch('  ub  ')).toBe(false)
    expect(service.canSearch('ube')).toBe(true)
  })

  it('com menos de 3 letras, nem chama o Photon', async () => {
    const repository = fakeRepository()

    await expect(createGeocodingService(repository).search('ub', 'pt')).resolves.toEqual([])
    expect(repository.search).not.toHaveBeenCalled()
  })

  it('passa o texto sem espaços nas pontas, o idioma, a preferência e o sinal', async () => {
    const repository = fakeRepository()
    const signal = new AbortController().signal

    await createGeocodingService(repository).search('  uberaba ', 'en', { near: { lat: -19.15, lon: -48.25 }, signal })

    expect(repository.search).toHaveBeenCalledWith('uberaba', {
      lang: 'en',
      near: { lat: -19.15, lon: -48.25 },
      signal,
    })
  })
})

describe('geocodingService.search: a lista do autocompletar', () => {
  it('cada lugar com o nome, onde fica (bairro, cidade, estado) e o ponto (GeoJSON é lon, lat)', async () => {
    const repository = fakeRepository(
      response(
        feature(
          {
            osm_type: 'W',
            osm_id: 1460357650,
            type: 'street',
            name: 'Rodovia Chico Xavier',
            district: 'Setor Sul',
            city: 'Uberlândia',
            state: 'Minas Gerais',
            country: 'Brasil',
            countrycode: 'BR',
          },
          -48.2128481,
          -18.9808048,
        ),
      ),
    )

    const [place] = await createGeocodingService(repository).search('rodovia chico xavier', 'pt')

    expect(place).toEqual({
      id: 'W1460357650',
      label: 'Rodovia Chico Xavier',
      detail: 'Setor Sul, Uberlândia, Minas Gerais',
      point: { lat: -18.9808048, lon: -48.2128481 },
    })
  })

  it('cidade: não repete o nome no detalhe; fora do Brasil, mostra o país', async () => {
    const repository = fakeRepository(
      response(
        feature({ osm_type: 'R', osm_id: 1, type: 'city', name: 'Uberaba', state: 'Minas Gerais', countrycode: 'BR', country: 'Brasil' }),
        feature({ osm_type: 'R', osm_id: 2, type: 'city', name: 'Uberaba', state: 'Paraná', country: 'Brasil', countrycode: 'BR' }),
        feature({ osm_type: 'N', osm_id: 3, name: 'Asunción', country: 'Paraguay', countrycode: 'PY' }),
      ),
    )

    const places = await createGeocodingService(repository).search('uberaba', 'pt')

    expect(places.map(({ label, detail }) => [label, detail])).toEqual([
      ['Uberaba', 'Minas Gerais'],
      ['Uberaba', 'Paraná'],
      ['Asunción', 'Paraguay'],
    ])
  })

  it('endereço sem nome: rua e número; sem id do OpenStreetMap, um id pela posição', async () => {
    const repository = fakeRepository(
      response(feature({ street: 'Rua Goiás', housenumber: '120', city: 'Uberlândia', state: 'Minas Gerais' })),
    )

    const [place] = await createGeocodingService(repository).search('rua goias 120', 'pt')

    expect(place).toMatchObject({ id: 'lugar-0', label: 'Rua Goiás, 120', detail: 'Uberlândia, Minas Gerais' })
  })

  it('tira lugares repetidos (mesmo nome e mesmo detalhe) e os que não têm nome', async () => {
    const same = { name: 'Rodovia BR-050', city: 'Uberaba', state: 'Minas Gerais' }
    const repository = fakeRepository(
      response(
        feature({ ...same, osm_type: 'W', osm_id: 1 }),
        feature({ ...same, osm_type: 'W', osm_id: 2 }),
        feature({ osm_type: 'W', osm_id: 3 }),
      ),
    )

    const places = await createGeocodingService(repository).search('br-050', 'pt')

    expect(places.map((place) => place.id)).toEqual(['W1'])
  })
})

describe('geocodingService.reverse: endereço aproximado perto do pino', () => {
  it('nome do lugar, bairro, cidade e estado, sem repetir', async () => {
    const repository = fakeRepository(
      response(
        feature({
          type: 'locality',
          name: 'Fazenda Maria Dória',
          city: 'Uberlândia',
          state: 'Minas Gerais',
          country: 'Brasil',
          countrycode: 'BR',
        }),
      ),
    )
    const signal = new AbortController().signal

    const address = await createGeocodingService(repository).reverse({ lat: -18.9543, lon: -48.1993 }, 'pt', { signal })

    expect(address).toBe('Fazenda Maria Dória, Uberlândia, Minas Gerais')
    expect(repository.reverse).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993 }, { lang: 'pt', signal })
  })

  it('sem nenhum lugar perto: null (a tela usa a cidade de referência mais perto)', async () => {
    const address = await createGeocodingService(fakeRepository(response())).reverse({ lat: -18.9, lon: -48.2 }, 'pt')

    expect(address).toBeNull()
  })
})
