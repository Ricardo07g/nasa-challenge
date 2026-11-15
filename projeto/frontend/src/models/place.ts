import type { Ponto } from './talhao'

/**
 * Resposta do Photon (komoot, dados do OpenStreetMap), em GeoJSON. Só os campos que a tela usa;
 * formato conferido em 15/11/2026 (`/api` e `/reverse`).
 */
export type PhotonProperties = {
  osm_type?: string
  osm_id?: number
  osm_key?: string
  osm_value?: string
  type?: string
  name?: string
  street?: string
  housenumber?: string
  locality?: string
  district?: string
  city?: string
  county?: string
  state?: string
  country?: string
  countrycode?: string
  postcode?: string
}

export type PhotonFeature = {
  type?: 'Feature'
  properties: PhotonProperties
  /** GeoJSON: [longitude, latitude]. */
  geometry: { type?: 'Point'; coordinates: [number, number] }
}

export type PhotonResponse = { type?: 'FeatureCollection'; features: PhotonFeature[] }

/** Um lugar da lista do autocompletar: nome, onde fica (cidade, estado) e o ponto. */
export type PlaceSuggestion = { id: string; label: string; detail: string; point: Ponto }

/** Opção da lista do campo de busca: um lugar do Photon ou o ponto das coordenadas (ou do link) colado. */
export type LocationOption =
  | ({ kind: 'place' } & PlaceSuggestion)
  | { kind: 'point'; id: string; source: 'coordinates' | 'link'; point: Ponto }

/** Aviso do campo de busca: link curto, link sem coordenadas ou coordenadas que não existem. */
export type LocationNotice = 'short-link' | 'link-without-point' | 'invalid-coordinates'
