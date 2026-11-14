import { describe, expect, it, vi } from 'vitest'
import type { CropOption } from '../models/cropOption'
import { createCropOptionService } from './cropOptionService'

const options: CropOption[] = [
  { id: 'milho-safrinha', name: 'Milho safrinha', role: 'Grão' },
  { id: 'milheto', name: 'Milheto', role: 'Cobertura' },
]

describe('cropOptionService.listOptions', () => {
  it('devolve as opções do repository', async () => {
    const service = createCropOptionService({ listAll: vi.fn().mockResolvedValue(options) })

    expect(await service.listOptions()).toEqual(options)
  })

  it('propaga o erro com mensagem amigável', async () => {
    const service = createCropOptionService({ listAll: vi.fn().mockRejectedValue(new Error('500')) })

    await expect(service.listOptions()).rejects.toThrow(
      'Não foi possível carregar as opções de entressafra',
    )
  })
})
