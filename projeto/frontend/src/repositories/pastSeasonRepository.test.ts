import { describe, expect, it, vi } from 'vitest'
import { createMockPastSeasonRepository } from './mocks/mockRepositories'
import { createHttpPastSeasonRepository } from './pastSeasonRepository'

describe('pastSeasonRepository (replay da safra passada, P4)', () => {
  it('http chama /api/safra-passada com lat, lon e o ano', async () => {
    const getJson = vi.fn().mockResolvedValue({ ano: 2024, opcao: 'milho_braquiaria', eventos: [] })

    await createHttpPastSeasonRepository(getJson).get({ lat: -18.9543, lon: -48.1993 }, 2024, 'pt')

    expect(getJson).toHaveBeenCalledWith('/api/safra-passada?lat=-18.9543&lon=-48.1993&ano=2024', { lang: 'pt' })
  })

  it('o detalhe de um ano do explorador manda a faixa de colheita e a opção da aba Sugestão (tarefa 0044)', async () => {
    const getJson = vi.fn().mockResolvedValue({ ano: 2016, opcao: 'sorgo', eventos: [] })

    await createHttpPastSeasonRepository(getJson).get({ lat: -18.9543, lon: -48.1993 }, 2016, 'en', {
      colheita: 'tarde',
      opcao: 'sorgo',
    })

    expect(getJson).toHaveBeenCalledWith(
      '/api/safra-passada?lat=-18.9543&lon=-48.1993&ano=2016&colheita=tarde&opcao=sorgo',
      { lang: 'en' },
    )
  })

  it('dados de exemplo: qualquer ano da série, com a opção pedida', async () => {
    const season = await createMockPastSeasonRepository(0).get({ lat: -18.9543, lon: -48.1993 }, 2016, 'pt', {
      opcao: 'sorgo',
    })

    expect(season.ano).toBe(2016)
    expect(season.opcao).toBe('sorgo')
    expect(season.eventos[0].data).toBe('2016-02-18')
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
