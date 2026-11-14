import { describe, expect, it, vi } from 'vitest'
import { createMockPastSeasonRepository } from './mocks/mockRepositories'
import { createHttpPastSeasonRepository } from './pastSeasonRepository'

describe('pastSeasonRepository (replay da safra passada, P4)', () => {
  it('http chama /api/safra-passada com lat, lon e o ano', async () => {
    const getJson = vi.fn().mockResolvedValue({ ano: 2024, opcao: 'milho_braquiaria', eventos: [] })

    await createHttpPastSeasonRepository(getJson).get({ lat: -18.9543, lon: -48.1993 }, 2024, 'pt')

    expect(getJson).toHaveBeenCalledWith('/api/safra-passada?lat=-18.9543&lon=-48.1993&ano=2024', { lang: 'pt' })
  })

  it('dados de exemplo: 2024 seco com avisos; 2023 bom, sem avisos', async () => {
    const repository = createMockPastSeasonRepository(0)
    const dry = await repository.get({ lat: -18.9543, lon: -48.1993 }, 2024, 'pt')
    const good = await repository.get({ lat: -18.9543, lon: -48.1993 }, 2023, 'en')

    expect(dry.eventos.map((evento) => evento.tipo)).toContain('aviso_veranico')
    expect(dry.eventos[0]).toEqual({ data: '2024-02-18', tipo: 'semeadura', texto: 'Semeadura do milho com braquiária.' })
    expect(good.eventos.some((evento) => evento.tipo.startsWith('aviso'))).toBe(false)
    expect(good.eventos.at(-1)?.texto).toBe('Harvest.')
  })
})
