import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Avisos, PontoAvisos } from '../models/avisos'
import type { SafraPassada } from '../models/pastSeason'
import { ApiError } from '../repositories/httpClient'
import { buildAvisos } from '../repositories/mocks/mockAvisos'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import type { AvisosService } from '../services/avisosService'
import type { FarmService } from '../services/farmService'
import type { PastSeasonService } from '../services/pastSeasonService'
import type { SpeechService } from '../services/speechService'
import { providers } from '../test/providers'
import { useAvisosController } from './useAvisosController'

const FIELD = '/avisos?lat=-18.9543&lon=-48.1993&colheita=meio'

const REPLAY: SafraPassada = {
  ano: 2024,
  opcao: 'sorgo',
  eventos: [
    { data: '2024-04-19', tipo: 'sem_chuva', texto: 'Parou de chover.' },
    { data: '2024-04-28', tipo: 'aviso_veranico', texto: 'Aviso: 10 dias sem chuva.' },
  ],
}

function deps(
  saved: PontoAvisos | null = null,
  get: (point: PontoAvisos) => Promise<Avisos> = (point) => Promise.resolve(buildAvisos(point, 'pt')),
) {
  const avisos: AvisosService = {
    get: vi.fn(get),
    savedPoint: vi.fn(() => saved),
    savePoint: vi.fn(),
  }
  const farm: FarmService = {
    talhao: vi.fn(),
    recomendacao: vi.fn((params, lang) => Promise.resolve(buildRecomendacao(params, lang))),
  }
  const pastSeason: PastSeasonService = { get: vi.fn(() => Promise.resolve(REPLAY)) }
  const speech: SpeechService = { isSupported: () => true, speak: vi.fn(), stop: vi.fn() }
  return { avisos, farm, pastSeason, speech }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useAvisosController (tela "Avisos", pacote 3)', () => {
  it('sem ponto na URL nem salvo no aparelho, pede para marcar a lavoura e não chama a API', () => {
    const d = deps()
    const { result } = renderHook(() => useAvisosController(d), { wrapper: providers('/avisos') })

    expect(result.current.status).toBe('no-point')
    expect(result.current.markTo).toBe('/onde')
    expect(d.avisos.get).not.toHaveBeenCalled()
  })

  it('usa o ponto da URL: o lugar, o resumo com o número do sino, "Atenção" antes, os quadros e o Voltar', async () => {
    const d = deps({ lat: -19.5, lon: -48.9 })
    const { result } = renderHook(() => useAvisosController(d), { wrapper: providers(FIELD) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(d.avisos.get).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')
    expect(result.current.place).toBe('Lavoura perto de Uberlândia (MG)')
    expect(result.current.summary).toEqual({ count: 2, attention: 1, tone: 'attention' })
    expect(result.current.now.map((a) => a.tipo)).toEqual(['terra_seca', 'enso'])
    expect(result.current.records).toHaveLength(4)
    expect(result.current.backTo).toBe('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')
  })

  it('a lavoura de demonstração (exemplo=1) aparece com o nome dela', async () => {
    const d = deps()
    const { result } = renderHook(() => useAvisosController(d), {
      wrapper: providers('/avisos?lat=-18.9543&lon=-48.1993&colheita=tarde&exemplo=1'),
    })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(d.avisos.get).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993, colheita: 'tarde', exemplo: true }, 'pt')
    expect(result.current.place).toBe('Lavoura de demonstração, perto de Uberlândia (MG)')
    expect(d.farm.recomendacao).toHaveBeenCalledWith(expect.objectContaining({ exemplo: true, colheita: 'tarde' }), 'pt')
  })

  it('sem ponto na URL, usa o ponto salvo no aparelho (com o plano que ele guardou)', async () => {
    const d = deps({ lat: -19.55, lon: -48.95, colheita: 'tarde', escolha: 'sorgo' })
    const { result } = renderHook(() => useAvisosController(d), { wrapper: providers('/avisos') })

    await waitFor(() => expect(result.current.plan).toEqual({ crop: 'sorgo', deadline: '2027-03-20', late: false }))
    expect(d.avisos.get).toHaveBeenCalledWith({ lat: -19.55, lon: -48.95, colheita: 'tarde', escolha: 'sorgo' }, 'pt')
    expect(result.current.backTo).toBe('/')
  })

  it('"Seu plano": a escolha da tela 5 com o prazo do ZARC, e os quadros da cultura só dessa cultura', async () => {
    const d = deps()
    const { result } = renderHook(() => useAvisosController(d), {
      wrapper: providers('/avisos?lat=-18.9543&lon=-48.1993&colheita=tarde&escolha=sorgo'),
    })

    await waitFor(() => expect(result.current.plan).toEqual({ crop: 'sorgo', deadline: '2027-03-20', late: false }))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.changes.map((a) => a.tipo)).toEqual(['mudou_veranico', 'mudou_fim_chuvas', 'mudou_calor'])
  })

  it('sem colheita não há recomendação: a cultura é a sugestão dos avisos e a linha fica sem o prazo', async () => {
    const d = deps()
    const { result } = renderHook(() => useAvisosController(d), { wrapper: providers('/avisos?lat=-18.9543&lon=-48.1993') })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(d.farm.recomendacao).not.toHaveBeenCalled()
    expect(result.current.plan).toEqual({ crop: 'milho_braquiaria', deadline: null, late: false })
  })

  it('"Ver exemplo": abre o modal e pede o replay do ano com a cultura do plano; fecha', async () => {
    const d = deps()
    const { result } = renderHook(() => useAvisosController(d), {
      wrapper: providers('/avisos?lat=-18.9543&lon=-48.1993&colheita=tarde&escolha=sorgo'),
    })
    await waitFor(() => expect(result.current.plan?.crop).toBe('sorgo'))
    expect(result.current.example.year).toBe(2024)
    expect(d.pastSeason.get).not.toHaveBeenCalled()

    act(() => result.current.example.onOpen())
    expect(result.current.example.open).toBe(true)
    await waitFor(() => expect(result.current.example.status).toBe('ready'))
    expect(d.pastSeason.get).toHaveBeenCalledWith({ lat: -18.9543, lon: -48.1993 }, 2024, 'pt', {
      colheita: 'tarde',
      opcao: 'sorgo',
    })
    expect(result.current.example.rows.map((row) => row.kind)).toEqual(['replay', 'record', 'record'])

    act(() => result.current.example.onClose())
    expect(result.current.example.open).toBe(false)
  })

  it('sem o replay (fora do prazo ou falha), o exemplo fica com os recordes do ano', async () => {
    const d = deps()
    d.pastSeason.get = vi.fn(() => Promise.reject(new ApiError('/api/safra-passada', 404, 'NOT_FOUND')))
    const { result } = renderHook(() => useAvisosController(d), { wrapper: providers(FIELD) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.example.onOpen())
    await waitFor(() => expect(result.current.example.status).toBe('ready'))
    expect(result.current.example.rows.map((row) => row.kind)).toEqual(['record', 'record'])
  })

  it('durante a safrinha não há exemplo (os avisos do plantio já aparecem em "Agora")', async () => {
    const d = deps(null, (point) => {
      const avisos = buildAvisos(point, 'pt')
      return Promise.resolve({ ...avisos, safrinha: { ...avisos.safrinha!, em_andamento: true } })
    })
    const { result } = renderHook(() => useAvisosController(d), { wrapper: providers(FIELD) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.example.year).toBeNull()
  })

  it('cada cartão e cada quadro abre o mesmo modal de detalhe', async () => {
    const d = deps()
    const { result } = renderHook(() => useAvisosController(d), { wrapper: providers(FIELD) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.openDetail('change', 1))
    expect(result.current.detail).toEqual({ kind: 'change', index: 1 })
    act(() => result.current.openDetail('now', 0))
    expect(result.current.detail).toEqual({ kind: 'now', index: 0 })
    act(() => result.current.closeDetail())
    expect(result.current.detail).toBeNull()
  })

  it('ponto fora da área preparada e erro de rede viram estados próprios', async () => {
    const outside = deps(null, () => Promise.reject(new ApiError('/api/avisos', 404, 'OUTSIDE_AREA')))
    const failing = deps(null, () => Promise.reject(new Error('rede')))

    const a = renderHook(() => useAvisosController(outside), { wrapper: providers(FIELD) })
    const b = renderHook(() => useAvisosController(failing), { wrapper: providers(FIELD) })

    await waitFor(() => expect(a.result.current.status).toBe('outside'))
    await waitFor(() => expect(b.result.current.status).toBe('error'))
  })

  it('com "#alertas-oficiais" no endereço, rola até os alertas oficiais depois de carregar', async () => {
    const target = document.createElement('section')
    target.id = 'alertas-oficiais'
    target.scrollIntoView = vi.fn()
    document.body.appendChild(target)
    const d = deps()

    const { result } = renderHook(() => useAvisosController(d), { wrapper: providers(`${FIELD}#alertas-oficiais`) })

    await waitFor(() => expect(result.current.status).toBe('ready'))
    await waitFor(() => expect(target.scrollIntoView).toHaveBeenCalled())
  })
})

describe('useAvisosController: "Ouvir resumo" (regra geral 9 do pacote 2)', () => {
  it('sem ponto: o que a tela faz, como marcar e os telefones de emergência', () => {
    const d = deps()
    const { result } = renderHook(() => useAvisosController(d), { wrapper: providers('/avisos') })

    act(() => result.current.listen.toggle())
    expect(d.speech.speak).toHaveBeenCalledWith(
      'Aqui aparecem os avisos de terra seca, calor e chuva da sua lavoura. Marque onde ela fica para ver os avisos, sem cadastro. Em emergência, ligue 193 para os bombeiros ou 199 para a Defesa Civil.',
      'pt',
      expect.any(Function),
    )
  })

  it('com avisos: quantos (o número do sino) e o que fazer em cada um; sem aviso, "Nada fora do normal"', async () => {
    const d = deps()
    const { result } = renderHook(() => useAvisosController(d), { wrapper: providers(FIELD) })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.listen.toggle())
    expect(d.speech.speak).toHaveBeenCalledWith(expect.stringMatching(/^Você tem 2 avisos agora\. A terra está mais seca/), 'pt', expect.any(Function))

    const quiet = deps(null, (point) =>
      Promise.resolve({ ...buildAvisos(point, 'en'), contador: 0, agora: { avisos: [], ultima_leitura: null } }),
    )
    const en = renderHook(() => useAvisosController(quiet), { wrapper: providers(FIELD, 'en') })
    await waitFor(() => expect(en.result.current.status).toBe('ready'))
    act(() => en.result.current.listen.toggle())
    expect(quiet.speech.speak).toHaveBeenCalledWith(
      'Nothing out of the ordinary on your field now. Alerts show up here when something changes.',
      'en',
      expect.any(Function),
    )
  })
})
