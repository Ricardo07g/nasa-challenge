import { describe, expect, it, vi } from 'vitest'
import { createMockPlanoRepository } from './mocks/mockPlano'
import { createHttpPlanoRepository } from './planoRepository'

describe('planoRepository (plano de 3 anos qualquer, tarefa 0045)', () => {
  it('http chama /api/plano com o ponto, a colheita e os 3 anos', async () => {
    const getJson = vi.fn().mockResolvedValue({})

    await createHttpPlanoRepository(getJson).get(
      { lat: -18.9543, lon: -48.1993, colheita: 'meio', anos: ['sorgo', 'pousio', 'crotalaria'] },
      'pt',
    )

    expect(getJson).toHaveBeenCalledWith(
      '/api/plano?lat=-18.9543&lon=-48.1993&colheita=meio&anos=sorgo,pousio,crotalaria',
      { lang: 'pt' },
    )
  })

  it('http leva o solo, quando houver', async () => {
    const getJson = vi.fn().mockResolvedValue({})

    await createHttpPlanoRepository(getJson).get(
      { lat: 1, lon: 2, colheita: 'tarde', anos: ['milheto', 'milheto', 'sorgo'], solo: 'arenoso' },
      'en',
    )

    expect(getJson).toHaveBeenCalledWith('/api/plano?lat=1&lon=2&colheita=tarde&anos=milheto,milheto,sorgo&solo=arenoso', {
      lang: 'en',
    })
  })

  it('http chama /api/plano/sugestao com os anos fixos (tela 5, tarefa 0056)', async () => {
    const getJson = vi.fn().mockResolvedValue({})

    await createHttpPlanoRepository(getJson).suggest(
      { lat: -18.9543, lon: -48.1993, colheita: 'tarde', fixos: ['sorgo', 'pousio'], solo: 'argiloso' },
      'en',
    )

    expect(getJson).toHaveBeenCalledWith(
      '/api/plano/sugestao?lat=-18.9543&lon=-48.1993&colheita=tarde&fixos=sorgo,pousio&solo=argiloso',
      { lang: 'en' },
    )
  })

  it('dados de exemplo da sugestão em cadeia: os anos fixos ficam, os outros vêm com o porquê', async () => {
    const plano = await createMockPlanoRepository(0).suggest(
      { lat: -18.9543, lon: -48.1993, colheita: 'tarde', fixos: ['sorgo', 'pousio'] },
      'pt',
    )

    expect(plano.anos.map((ano) => ano.cultura)).toEqual(['sorgo', 'pousio', 'milheto'])
    expect(plano.anos.map((ano) => ano.fixo)).toEqual([true, true, false])
    expect(plano.anos[2].motivo).toMatch(/terra ficou descoberta/)
    expect(plano.anos[0].motivo).toBeNull()
  })

  it('dados de exemplo da colheita tarde: cultura fora do prazo vem com os números e fora_do_prazo', async () => {
    const plano = await createMockPlanoRepository(0).get(
      { lat: -18.9543, lon: -48.1993, colheita: 'tarde', anos: ['milho_safrinha', 'milheto', 'sorgo'] },
      'pt',
    )

    expect(plano.anos[0]).toMatchObject({ cultura: 'milho_safrinha', fora_do_prazo: true, fixo: true })
    expect(plano.anos[0].anos_bons).not.toBeNull()
  })

  it('dados de exemplo: os 3 anos pedidos, com as notas e o Plano A/B do 1º ano', async () => {
    const plano = await createMockPlanoRepository(0).get(
      { lat: -18.9543, lon: -48.1993, colheita: 'meio', anos: ['milho_braquiaria', 'pousio', 'crotalaria'] },
      'pt',
    )

    expect(plano.anos.map((ano) => ano.cultura)).toEqual(['milho_braquiaria', 'pousio', 'crotalaria'])
    expect(plano.anos[1]).toMatchObject({ nome: 'Deixar parado', anos_bons: null, usa_mm: null, cobre_terra: false })
    expect(plano.notas.seguranca).not.toBeNull()
    expect(plano.plano_ab?.cultura_a).toBe('milho_braquiaria')
    expect(plano.terra.total).toBe(3)
  })
})
