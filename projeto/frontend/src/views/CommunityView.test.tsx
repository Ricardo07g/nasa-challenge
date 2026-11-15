import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { CommunityFormState } from '../controllers/useCommunityController'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { RelatoComunidade } from '../models/community'
import { createMockRegionRepository } from '../repositories/mocks/mockRepositories'
import { cellMarkers, nearbySummary, regionSummary } from '../services/communityService'
import { CommunityView, type CommunityViewProps } from './CommunityView'

const center = { lat: -18.9543, lon: -48.1993 }
const region = regionSummary(await createMockRegionRepository(0).get(center, 'pt'))
const TODAY = '2026-11-15'

function relato(changes: Partial<RelatoComunidade>): RelatoComunidade {
  return {
    id: 'r1',
    tipo: 'chuva',
    subtipo: null,
    valores: { mm: 20 },
    celula: '-190_-482',
    lat: -18.95,
    lon: -48.15,
    data_fato: TODAY,
    meu: false,
    ...changes,
  }
}

const RELATOS: RelatoComunidade[] = [
  relato({ id: 'c1', valores: { mm: 20 } }),
  relato({ id: 'c2', valores: { mm: 11 }, data_fato: '2026-11-12' }),
  relato({ id: 'e1', tipo: 'evento', subtipo: 'granizo', valores: {}, data_fato: '2026-11-10' }),
  relato({ id: 'e2', tipo: 'evento', subtipo: 'fogo', valores: {}, data_fato: '2026-11-14', meu: true }),
  relato({ id: 'p1', tipo: 'plantio', subtipo: 'milheto', valores: { ano: 2026, resultado: 'bem' }, data_fato: null }),
  relato({ id: 'p2', tipo: 'plantio', subtipo: 'milheto', valores: { ano: 2026, resultado: 'perdi', motivo: 'seca' }, data_fato: null }),
  relato({ id: 'p3', tipo: 'plantio', subtipo: 'pousio', valores: { ano: 2026 }, data_fato: null, meu: true }),
]

const FORM: CommunityFormState = {
  open: null,
  planting: { crop: null, year: 2026, outcome: null, reason: null },
  rain: { mm: '', date: TODAY },
  event: { event: null, date: TODAY },
  bounds: { min: '2026-10-16', max: TODAY },
  ready: false,
  sending: false,
  result: null,
  showNotice: true,
  fireCall: false,
}

function setup(overrides: Partial<CommunityViewProps> = {}, form: Partial<CommunityFormState> = {}) {
  const data = { raio_km: 30, anos_safra: [2024, 2025, 2026], relatos: RELATOS }
  const props: CommunityViewProps = {
    t: pt,
    lang: 'pt',
    backTo: '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio',
    center,
    radiusKm: 30,
    status: 'ready',
    onRetry: vi.fn(),
    summary: nearbySummary(data, TODAY),
    markers: cellMarkers(RELATOS),
    canTell: true,
    markTo: '/onde',
    years: [2024, 2025, 2026],
    form: { ...FORM, ...form },
    onOpenForm: vi.fn(),
    onPlanting: vi.fn(),
    onRain: vi.fn(),
    onEvent: vi.fn(),
    onSend: vi.fn(),
    onRemove: vi.fn(),
    removing: null,
    region: null,
    regionStatus: 'outside',
    onRegionRetry: vi.fn(),
    regionRadius: null,
    regionDistance: null,
    history: null,
    ...overrides,
  }
  render(
    <MemoryRouter>
      <CommunityView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('CommunityView ("Na sua região": contar e ver a redondeza)', () => {
  it('título, subtítulo dos relatos, o Voltar e o link para o Guia no fim', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Na sua região' })).toBeInTheDocument()
    expect(screen.getByText('O que os vizinhos contam, até 30 km da sua lavoura')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')
    expect(screen.getByRole('link', { name: 'Guia: dúvidas e respostas curtas' })).toHaveAttribute('href', '/guia')
  })

  it('contar: três relatos, cada um num botão', async () => {
    const props = setup()

    const tell = screen.getByRole('group', { name: 'Conte o que aconteceu aí' })
    await userEvent.click(within(tell).getByRole('button', { name: 'O que plantei depois da soja' }))
    await userEvent.click(within(tell).getByRole('button', { name: 'Choveu aqui' }))
    await userEvent.click(within(tell).getByRole('button', { name: 'Aconteceu aqui' }))

    expect(props.onOpenForm).toHaveBeenNthCalledWith(1, 'plantio')
    expect(props.onOpenForm).toHaveBeenNthCalledWith(2, 'chuva')
    expect(props.onOpenForm).toHaveBeenNthCalledWith(3, 'evento')
  })

  it('sem a lavoura marcada: pede para marcar antes de contar', () => {
    setup({ canTell: false })

    expect(screen.queryByRole('group', { name: 'Conte o que aconteceu aí' })).not.toBeInTheDocument()
    expect(screen.getByText('Para contar, primeiro marque onde fica a sua lavoura.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Marcar minha lavoura' })).toHaveAttribute('href', '/onde')
  })

  it('"O que plantei": culturas com "Outra" e "Deixei parado", a safra mais recente marcada e como foi', async () => {
    const props = setup({}, { open: 'plantio' })

    const crops = screen.getByRole('group', { name: 'O que você plantou?' })
    expect(within(crops).getAllByRole('button')).toHaveLength(7)
    await userEvent.click(within(crops).getByRole('button', { name: 'Deixei parado' }))
    expect(props.onPlanting).toHaveBeenCalledWith({ crop: 'pousio' })
    expect(within(screen.getByRole('group', { name: 'Em que safra?' })).getByRole('button', { name: '2026' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Perdi' }))
    expect(props.onPlanting).toHaveBeenCalledWith({ outcome: 'perdi' })
    expect(screen.queryByRole('group', { name: 'Por que perdeu?' })).not.toBeInTheDocument()
  })

  it('se perdeu, pergunta o motivo; quem deixou parado não diz como foi', () => {
    setup({}, { open: 'plantio', planting: { crop: 'sorgo', year: 2026, outcome: 'perdi', reason: null } })
    const reasons = screen.getByRole('group', { name: 'Por que perdeu?' })
    expect(within(reasons).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Seca',
      'Calor',
      'Geada',
      'Granizo',
      'Praga',
      'Outro motivo',
    ])
  })

  it('"Deixei parado" não pergunta como foi', () => {
    setup({}, { open: 'plantio', planting: { crop: 'pousio', year: 2026, outcome: null, reason: null } })

    expect(screen.queryByRole('group', { name: 'Como foi?' })).not.toBeInTheDocument()
  })

  it('antes do primeiro envio, avisa que os vizinhos veem a região; enviar só com tudo escolhido', async () => {
    const props = setup({}, { open: 'plantio' })

    expect(screen.getByText('Seus vizinhos veem a região, não o seu ponto.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
    expect(props.onSend).not.toHaveBeenCalled()
  })

  it('depois do primeiro envio, o aviso não aparece de novo', async () => {
    const props = setup({}, { open: 'chuva', ready: true, showNotice: false })

    expect(screen.queryByText('Seus vizinhos veem a região, não o seu ponto.')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Enviar' }))
    expect(props.onSend).toHaveBeenCalled()
  })

  it('"Choveu aqui": milímetros e a data, de 30 dias atrás até hoje', async () => {
    const props = setup({}, { open: 'chuva' })

    await userEvent.type(screen.getByLabelText('Quantos milímetros choveu?'), '3')
    expect(props.onRain).toHaveBeenCalledWith({ mm: '3' })
    const date = screen.getByLabelText('Que dia?')
    expect(date).toHaveValue(TODAY)
    expect(date).toHaveAttribute('min', '2026-10-16')
    expect(date).toHaveAttribute('max', TODAY)
  })

  it('relato de enxurrada ou erosão liga para o artigo "Como evitar erosão" (tarefa 0049)', () => {
    setup({}, { open: 'evento', event: { event: 'enxurrada_erosao', date: TODAY } })

    expect(screen.getByRole('link', { name: 'Saiba mais: Como evitar erosão' })).toHaveAttribute('href', '/guia/como-evitar-erosao')
    expect(screen.queryByRole('link', { name: 'Saiba mais: Fogo na palha' })).not.toBeInTheDocument()
  })

  it('"Aconteceu aqui": a lista fechada e, com fogo, o 193 dos Bombeiros', async () => {
    const props = setup({}, { open: 'evento', event: { event: 'fogo', date: TODAY }, fireCall: true })

    const events = screen.getByRole('group', { name: 'O que aconteceu?' })
    expect(within(events).getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Fogo',
      'Granizo',
      'Geada',
      'Vendaval',
      'Enxurrada ou erosão',
      'Praga ou doença',
    ])
    expect(screen.getByRole('alert')).toHaveTextContent('Em caso de fogo, ligue 193 (Bombeiros).')
    expect(screen.getByRole('link', { name: 'Ligar 193' })).toHaveAttribute('href', 'tel:193')
    expect(screen.getByRole('link', { name: 'Saiba mais: Fogo na palha' })).toHaveAttribute('href', '/guia/fogo-na-palha')
    await userEvent.click(within(events).getByRole('button', { name: 'Geada' }))
    expect(props.onEvent).toHaveBeenCalledWith({ event: 'geada' })
  })

  it('enviado: confirma; passou do limite: avisa', () => {
    setup({}, { result: 'sent' })
    expect(screen.getByRole('status')).toHaveTextContent('Pronto! Seu relato já aparece para os vizinhos.')
  })

  it('passou do limite por dia: avisa com o número', () => {
    setup({}, { open: 'evento', result: 'limit' })
    expect(screen.getByRole('alert')).toHaveTextContent('Você já mandou 10 relatos hoje. Tente de novo amanhã.')
  })

  it('"Perto de você": plantio, chuva e eventos, cada um como relato de vizinho não confirmado', () => {
    setup()

    const near = screen.getByRole('region', { name: 'Perto de você' })
    expect(near).toHaveTextContent(
      '3 vizinhos contaram o que fizeram depois da soja em 2026: 2 milheto, 1 deixou parado.',
    )
    expect(near).toHaveTextContent('1 de 3 disse que foi bem.')
    expect(near).toHaveTextContent('Nos últimos 7 dias, os pluviômetros marcaram em média 15,5 mm (2 relatos).')
    const events = within(near).getByRole('list', { name: 'O que aconteceu nos últimos 30 dias' })
    expect(within(events).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Fogo, em 14 de novembroRelato de vizinho, não confirmado',
      'Granizo, em 10 de novembroRelato de vizinho, não confirmado',
    ])
    expect(within(near).getAllByText('Relato de vizinho, não confirmado')).toHaveLength(4)
    expect(screen.queryByText('Exemplo')).not.toBeInTheDocument()
  })

  it('mapa da redondeza com o círculo de 30 km e cada célula com texto por tipo', () => {
    setup()

    const map = screen.getByRole('region', { name: 'Mapa dos relatos até 30 km da sua lavoura' })
    expect(within(map).getByText('Círculo de 30 km em volta da sua lavoura')).toBeInTheDocument()
    const cells = within(map).getByRole('list', { name: 'Mapa dos relatos até 30 km da sua lavoura' })
    expect(cells).toHaveTextContent('3 de plantio, 2 de chuva, 2 eventos')
    expect(within(map).getByRole('list', { name: 'Legenda do mapa' })).toHaveTextContent('PlantioChuvaEvento')
  })

  it('dados de demonstração: cada item com o selo "Exemplo"', () => {
    const examples = RELATOS.map((r) => ({ ...r, exemplo: true, meu: false }))
    setup({ summary: nearbySummary({ raio_km: 30, anos_safra: [2026], relatos: examples }, TODAY) })

    const near = screen.getByRole('region', { name: 'Perto de você' })
    expect(within(near).getAllByText('Exemplo')).toHaveLength(4)
  })

  it('sem relatos: convida a ser o primeiro, sem mapa e sem relato inventado', () => {
    setup({ summary: nearbySummary({ raio_km: 30, anos_safra: [2026], relatos: [] }, TODAY), markers: [] })

    expect(screen.getByText('Ainda não há relatos perto de você. Seja o primeiro a contar.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Mapa dos relatos/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Relato de vizinho, não confirmado')).not.toBeInTheDocument()
  })

  it('os meus relatos, com "Apagar"', async () => {
    const props = setup()

    const mine = screen.getByRole('region', { name: 'Seus relatos' })
    expect(within(mine).getAllByRole('listitem').map((item) => item.firstChild?.textContent)).toEqual([
      'Fogo, em 14 de novembro',
      'Deixei parado, safra 2026',
    ])
    await userEvent.click(within(mine).getByRole('button', { name: 'Apagar o relato: Fogo, em 14 de novembro' }))
    expect(props.onRemove).toHaveBeenCalledWith('e2')
  })

  it('comunidade sem banco no servidor: nem contar nem a redondeza (sem aviso), o Guia continua', () => {
    setup({ status: 'not-connected', summary: null, markers: [] })

    expect(screen.queryByRole('group', { name: 'Conte o que aconteceu aí' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Perto de você' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Guia: dúvidas e respostas curtas' })).toBeInTheDocument()
  })

  it('enquanto carrega e quando dá erro', async () => {
    setup({ status: 'loading', summary: null, markers: [] })
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
  })

  it('erro ao carregar: tentar de novo', async () => {
    const props = setup({ status: 'error', summary: null, markers: [] })

    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(props.onRetry).toHaveBeenCalled()
  })

  it('região pelo satélite (quando o arquivo da região existir): o último ano em destaque', () => {
    setup({ region, regionStatus: 'ready', regionRadius: 30, history: { idle: 5, known: 9, uncertain: 1 } })

    expect(screen.getByText('Até 30 km da sua lavoura · visto pelo satélite')).toBeInTheDocument()
    expect(screen.getByText('Em 2025, 62% da área de soja ficou parada depois da colheita.')).toBeInTheDocument()
  })

  it('sem o arquivo da região: o bloco do satélite não aparece', () => {
    setup()

    expect(screen.queryByText(/da área de soja ficou parada/)).not.toBeInTheDocument()
    expect(screen.queryByText(/visto pelo satélite/)).not.toBeInTheDocument()
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en' }, { open: 'evento', fireCall: true })

    expect(screen.getByRole('heading', { level: 1, name: 'In your region' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Tell what happened there' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('In case of fire, call 193 (Fire Department).')
    expect(screen.getByRole('region', { name: 'Near you' })).toHaveTextContent(
      'In the last 7 days, rain gauges showed 15.5 mm on average (2 reports).',
    )
  })
})
