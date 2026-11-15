import { describe, expect, it, vi } from 'vitest'
import { createMockRaioXRepository } from './mocks/mockRepositories'
import { createHttpRaioXRepository } from './raioXRepository'

describe('raioXRepository (raio-X da sua terra, tela 4)', () => {
  it('http chama /api/raio-x com lat, lon e a colheita', async () => {
    const getJson = vi.fn().mockResolvedValue({})

    await createHttpRaioXRepository(getJson).get({ lat: -18.9543, lon: -48.1993, colheita: 'tarde' }, 'pt')

    expect(getJson).toHaveBeenCalledWith('/api/raio-x?lat=-18.9543&lon=-48.1993&colheita=tarde', { lang: 'pt' })
  })

  it('http leva o solo e as safras confirmadas, quando houver', async () => {
    const getJson = vi.fn().mockResolvedValue({})

    await createHttpRaioXRepository(getJson).get(
      { lat: -18.9543, lon: -48.1993, colheita: 'meio', solo: 'arenoso', confirmadas: '2025:parado' },
      'en',
    )

    expect(getJson).toHaveBeenCalledWith(
      '/api/raio-x?lat=-18.9543&lon=-48.1993&colheita=meio&solo=arenoso&confirmadas=2025:parado',
      { lang: 'en' },
    )
  })

  it('dados de exemplo: os 8 blocos, a faixa de 2017 a 2026 e o alerta de chuva forte', async () => {
    const raio = await createMockRaioXRepository(0).get({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')

    expect(raio.solo?.textura).toBe('medio')
    expect([raio.agua, raio.umidade, raio.verde, raio.chuva, raio.veranico, raio.calor, raio.regiao]).not.toContain(null)
    expect(raio.historico_ndvi?.anos.map((row) => row.ano)).toEqual([
      2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
    ])
    expect(raio.alertas.chuva_forte).not.toBeNull()
    expect(raio.alertas.geada).toBeNull()
  })
})
