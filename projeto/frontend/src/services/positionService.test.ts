import { describe, expect, it, vi } from 'vitest'
import { createPositionService } from './positionService'

describe('positionService', () => {
  it('arredonda a posição do GPS em 4 casas (cerca de 10 m, sem guardar mais que o necessário)', async () => {
    const service = createPositionService({ current: vi.fn().mockResolvedValue({ lat: -18.923456, lon: -48.281234 }) })

    expect(await service.current()).toEqual({ lat: -18.9235, lon: -48.2812 })
  })
})
