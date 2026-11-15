import { describe, expect, it, vi } from 'vitest'
import type { PhotonFeature, PhotonResponse } from '../models/place'
import type { GeocodingRepository } from '../repositories/geocodingRepository'
import { createGeocodingService, SEARCH_DELAY_MS } from './geocodingService'

const feature = (properties: PhotonFeature['properties'], lon = -48.2, lat = -18.9): PhotonFeature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates: [lon, lat] },
})

const response = (...features: PhotonFeature[]): PhotonResponse => ({ type: 'FeatureCollection', features })

function fakeRepository(data: PhotonResponse = response()) {
  return { reverse: vi.fn().mockResolvedValue(data) } satisfies GeocodingRepository
}

describe('geocodingService: regras de uso do Photon', () => {
  it('espera 400 ms depois de o ponto parar (tocar ou arrastar o alfinete) antes de pedir o endereço', () => {
    expect(SEARCH_DELAY_MS).toBe(400)
  })

  it('sem a busca por endereço (saiu da tela "Onde fica a lavoura", tarefa 0053)', () => {
    expect('search' in createGeocodingService(fakeRepository())).toBe(false)
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

  it('fora do Brasil, o país entra no fim', async () => {
    const repository = fakeRepository(
      response(feature({ name: 'Ciudad del Este', state: 'Alto Paraná', country: 'Paraguay', countrycode: 'PY' })),
    )

    const address = await createGeocodingService(repository).reverse({ lat: -25.5, lon: -54.6 }, 'en')

    expect(address).toBe('Ciudad del Este, Alto Paraná, Paraguay')
  })

  it('sem nenhum lugar perto: null (a tela usa a cidade de referência mais perto)', async () => {
    const address = await createGeocodingService(fakeRepository(response())).reverse({ lat: -18.9, lon: -48.2 }, 'pt')

    expect(address).toBeNull()
  })
})
