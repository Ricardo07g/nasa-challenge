import { describe, expect, it, vi } from 'vitest'
import type { PontoAvisos } from '../models/avisos'
import type { RaioX } from '../models/raioX'
import type { SavedPointRepository } from '../repositories/savedPointRepository'
import { readFlowParams } from './flowParams'
import { createGuideFieldService, FIELD_SLUGS, fieldFact, fieldPoint, fieldRequest, hasFieldData } from './guideFieldService'
import type { RaioXService } from './raioXService'

/** Os números do `/api/raio-x` da lavoura de demonstração (API de revisão, 15/11/2026). */
const raio: RaioX = {
  ponto: { lat: -18.9543, lon: -48.1993 },
  celula_id: '-190_-482',
  leitura_recente: '2026-11-10',
  altitude_m: null,
  solo: { textura: 'argiloso', argila_pct: 41.9, areia_pct: 40.2, cad_mm: 60, vizinho_km: null },
  agua: {
    cad_mm: 60,
    dias: 13,
    cultura: 'milho_braquiaria',
    nome: 'Milho com braquiária',
    floracao: '04-19',
    eto_mm_dia: 3.6,
    kc: 1.2,
    consumo_mm_dia: 4.3,
    fonte_eto: 'nasa_power',
  },
  umidade: { percentil: 59.3, data: '2026-11-10' },
  verde: null,
  chuva: {
    media_mm: 862.1,
    anos: [2005, 2024],
    fonte: 'gpm_imerg',
    fim_das_chuvas: {
      mediana: '04-21',
      mais_cedo: { dia: '03-16', ano: 2021 },
      mais_tarde: { dia: '06-22', ano: 2012 },
      anos: [2005, 2024],
      fonte: 'gpm_imerg',
      inicio: '03-01',
      dias: 20,
      chuva_max_mm: 10,
    },
  },
  veranico: { dias: 43, ano: 2024, inicio: '04-19', total_anos: 20, fonte: 'gpm_imerg' },
  calor: { anos_com_calor: 1, total_anos: 20, temp_c: 35, anos: [2024], fonte: 'nasa_power' },
  regiao: null,
  historico_ndvi: null,
  alertas: {
    geada: null,
    chuva_forte: { media_dias_ano: 0.25, dias: 5, total_anos: 20, limite_mm: 50, fonte: 'gpm_imerg' },
    fogo: { anos: [2016, 2018, 2019, 2020, 2024], total_anos: 10, raio_km: 5, fonte: 'MODIS MCD64A1' },
  },
  cartoes: {
    chuva_20_anos: null,
    clima_futuro: {
      chuva_pct: 2.2,
      tmax_c: 1.3,
      modelos: 3,
      modelos_menos_chuva: 1,
      modelos_mais_chuva: 2,
      modelos_mais_quente: 3,
      cenario: 'ssp245',
      periodo: '2041-2060',
    },
  },
}

describe('fieldFact (o número real de "Na sua lavoura" de cada artigo)', () => {
  it('erosão → os dias de chuva forte do GPM IMERG', () => {
    expect(fieldFact('como-evitar-erosao', raio)).toEqual({ kind: 'heavyRain', data: raio.alertas.chuva_forte })
  })

  it('veranico → o maior veranico; calor → os anos com 35 °C; clima de 2041 a 2060', () => {
    expect(fieldFact('veranico', raio)).toEqual({ kind: 'dryspell', data: raio.veranico })
    expect(fieldFact('calor-35-graus', raio)).toEqual({ kind: 'heat', data: raio.calor })
    expect(fieldFact('clima-2041-2060', raio)).toEqual({ kind: 'future', data: raio.cartoes.clima_futuro })
  })

  it('número que depende de hipótese do time não entra (geada de 3 °C, fogo a 5 km, água da terra, fim das chuvas)', () => {
    const frost = { anos: [2011], total_anos: 20, temp_c: 3, menor_temp_c: 1.5, fonte: 'nasa_power' }
    expect(fieldFact('geada-na-safrinha', { ...raio, alertas: { ...raio.alertas, geada: frost } })).toBeNull()
    expect(fieldFact('fogo-na-palha', raio)).toBeNull()
    expect(fieldFact('conta-de-agua', raio)).toBeNull()
    expect(fieldFact('quando-a-chuva-acaba', raio)).toBeNull()
  })

  it('raio-X → os valores do raio-X (terra, umidade e chuva)', () => {
    expect(fieldFact('raio-x', raio)).toEqual({ kind: 'xray', soil: raio.solo, moisture: raio.umidade, rain: raio.chuva })
  })

  it('sem o dado no raio-X, sem caixa', () => {
    expect(fieldFact('como-evitar-erosao', { ...raio, alertas: { ...raio.alertas, chuva_forte: null } })).toBeNull()
    expect(fieldFact('veranico', { ...raio, veranico: null })).toBeNull()
    expect(fieldFact('raio-x', { ...raio, solo: null, umidade: null, chuva: null })).toBeNull()
  })

  it('artigo sem dado ligado ou sem raio-X: sem caixa', () => {
    expect(fieldFact('sementes', raio)).toBeNull()
    expect(fieldFact('veranico', null)).toBeNull()
    expect(hasFieldData('sementes')).toBe(false)
    expect(hasFieldData('veranico')).toBe(true)
    expect(FIELD_SLUGS).toEqual(['como-evitar-erosao', 'veranico', 'calor-35-graus', 'clima-2041-2060', 'raio-x'])
  })
})

describe('fieldPoint (de quem é a lavoura)', () => {
  const saved: PontoAvisos = { lat: -19.1, lon: -48.3, colheita: 'cedo' }
  const flow = (query: string) => readFlowParams(new URLSearchParams(query))

  it('o ponto da URL vem antes do salvo no aparelho', () => {
    expect(fieldPoint(flow('lat=-18.9543&lon=-48.1993'), saved)).toEqual({ lat: -18.9543, lon: -48.1993 })
  })

  it('sem ponto na URL, o salvo no aparelho; sem nenhum, nada', () => {
    expect(fieldPoint(null, saved)).toBe(saved)
    expect(fieldPoint(null, null)).toBeNull()
  })

  it('a fazenda de exemplo nunca vira a lavoura do produtor', () => {
    expect(fieldPoint(flow('lat=-18.9543&lon=-48.1993&exemplo=1'), null)).toBeNull()
    expect(fieldPoint(flow('lat=-18.9543&lon=-48.1993&exemplo=1'), saved)).toBe(saved)
  })

  it('pede o raio-X com a colheita e a terra do ponto (sem colheita, meio)', () => {
    expect(fieldRequest({ lat: -18.9, lon: -48.2 })).toEqual({ lat: -18.9, lon: -48.2, colheita: 'meio' })
    expect(fieldRequest({ lat: -18.9, lon: -48.2, colheita: 'tarde', solo: 'arenoso' })).toEqual({
      lat: -18.9,
      lon: -48.2,
      colheita: 'tarde',
      solo: 'arenoso',
    })
  })
})

describe('createGuideFieldService', () => {
  const point: PontoAvisos = { lat: -18.9543, lon: -48.1993 }

  function setup(get: RaioXService['get'] = vi.fn(async () => raio)) {
    const raioX = { get: vi.fn(get) }
    const saved: SavedPointRepository = { get: vi.fn(() => point), save: vi.fn() }
    return { raioX, saved, service: createGuideFieldService(raioX, saved) }
  }

  it('busca o raio-X do ponto e devolve o dado do artigo', async () => {
    const { raioX, service } = setup()
    await expect(service.fact('veranico', point, 'pt')).resolves.toEqual({ kind: 'dryspell', data: raio.veranico })
    expect(raioX.get).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')
  })

  it('artigo sem dado ligado ou sem ponto: não pede nada', async () => {
    const { raioX, service } = setup()
    await expect(service.fact('sementes', point, 'pt')).resolves.toBeNull()
    await expect(service.fact('veranico', null, 'pt')).resolves.toBeNull()
    expect(raioX.get).not.toHaveBeenCalled()
  })

  it('lê o ponto salvo no aparelho (o mesmo dos avisos)', () => {
    const { service } = setup()
    expect(service.savedPoint()).toBe(point)
  })
})
