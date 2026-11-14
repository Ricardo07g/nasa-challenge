import type { CropOption } from '../models/cropOption'
import {
  cropOptionRepository,
  type CropOptionRepository,
} from '../repositories/cropOptionRepository'

export type CropOptionService = {
  listOptions(): Promise<CropOption[]>
}

export function createCropOptionService(
  repository: CropOptionRepository = cropOptionRepository,
): CropOptionService {
  return {
    async listOptions() {
      try {
        return await repository.listAll()
      } catch {
        throw new Error('Não foi possível carregar as opções de entressafra')
      }
    },
  }
}

export const cropOptionService = createCropOptionService()
