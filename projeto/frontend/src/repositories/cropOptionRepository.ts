import type { CropOption } from '../models/cropOption'
import { getJson } from './httpClient'

export type CropOptionRepository = {
  listAll(): Promise<CropOption[]>
}

export const cropOptionRepository: CropOptionRepository = {
  listAll: () => getJson<CropOption[]>('/api/crop-options'),
}
