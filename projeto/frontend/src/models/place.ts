/**
 * Resposta do Photon (komoot, dados do OpenStreetMap), em GeoJSON. Só os campos que a tela usa;
 * formato conferido em 15/11/2026 (`/reverse`, o endereço aproximado do alfinete).
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
