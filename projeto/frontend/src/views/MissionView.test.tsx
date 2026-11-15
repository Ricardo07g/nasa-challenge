import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { MissionView, type MissionViewProps } from './MissionView'

const facts = {
  point: { lat: -18.9543, lon: -48.1993 },
  soil: 'medio' as const,
  soilSource: 'SoilGrids' as string | null,
  smap: { start: '2016', end: '2024' } as { start: string; end: string } | null,
  rainYears: 20 as number | null,
  rainSource: 'GPM IMERG' as string | null,
  historyYears: 10 as number | null,
  future: { period: { start: '2041', end: '2060' } } as { period: { start: string; end: string } | null } | null,
  signal: 'seco' as 'seco' | null,
  signalSource: 'NOAA' as string | null,
  options: 6 as number | null,
  burned: { start: '2016', end: '2025' } as { start: string; end: string } | null,
}

function setup(overrides: Partial<MissionViewProps> = {}) {
  const props: MissionViewProps = {
    t: pt,
    lang: 'pt',
    status: 'ready',
    phase: 2,
    complete: false,
    facts,
    place: 'Uberlândia (MG)',
    weak: false,
    reducedMotion: false,
    spins: 0,
    backTo: '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
    continueTo: '/satelite?lat=-18.9543&lon=-48.1993&colheita=meio',
    onSpin: vi.fn(),
    onWait: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <MissionView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('MissionView (tela de cálculo, RF-19)', () => {
  it('mostra a missão, o progresso e as fases já feitas com o dado real', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Missão: sua lavoura' })).toBeInTheDocument()
    expect(screen.getByText('Perto de Uberlândia (MG)')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Missão: sua lavoura' })).toHaveAttribute('aria-valuenow', '2')
    expect(screen.getByText('Dados coletados 2/6')).toBeInTheDocument()
    const phases = screen.getAllByRole('listitem')
    expect(phases).toHaveLength(6)
    expect(phases[0]).toHaveAttribute('data-state', 'done')
    expect(phases[0]).toHaveTextContent('Satélite em órbita')
    expect(phases[0]).toHaveTextContent('Lavoura encontrada: -18,95 / -48,20')
    expect(phases[1]).toHaveTextContent('Terra média')
    expect(phases[2]).toHaveAttribute('data-state', 'current')
    expect(phases[5]).toHaveAttribute('data-state', 'locked')
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute(
      'href',
      '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
  })

  it('não revela a melhor opção: a última fase só diz que a resposta está pronta', () => {
    setup({ phase: 6, complete: true })

    expect(screen.getAllByRole('listitem')[4]).toHaveTextContent('Previsão do outono (NOAA): sinal de ano seco')
    expect(screen.getAllByRole('listitem')[5]).toHaveTextContent('Resposta pronta')
  })

  it('tocar no satélite chama o controller', async () => {
    const props = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Satélite (toque para girar)' }))

    expect(props.onSpin).toHaveBeenCalled()
  })

  it('com menos movimento, vira uma lista simples, sem a cena', () => {
    setup({ reducedMotion: true })

    expect(screen.queryByRole('button', { name: 'Satélite (toque para girar)' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
  })

  it('cada fase diz a fonte que foi usada, e a última conta o número certo de opções (tarefa 0049)', () => {
    setup({ phase: 6, complete: true, facts: { ...facts, options: 3 } })

    const phases = screen.getAllByRole('listitem')
    expect(phases[1]).toHaveTextContent('Terra média (SoilGrids)')
    expect(phases[1]).toHaveTextContent('Umidade da terra no dia de plantar: SMAP, de 2016 a 2024')
    expect(phases[3]).toHaveTextContent('10 anos de histórico do satélite (MODIS NDVI)')
    expect(phases[3]).toHaveTextContent('Área queimada: MODIS MCD64A1, de 2016 a 2025')
    expect(phases[4]).toHaveTextContent('Clima de 2041 a 2060 lido (NEX-GDDP-CMIP6)')
    expect(phases[5]).toHaveTextContent('Fazendo a conta das 3 opções')
    expect(screen.queryByText(/6 opções/)).not.toBeInTheDocument()
  })

  it('sem SMAP, sem IMERG e sem mapa de solos, a fase não cita a fonte que não foi usada', () => {
    setup({ phase: 6, complete: true, facts: { ...facts, smap: null, rainSource: 'NASA POWER', soilSource: null, options: null, burned: null } })

    const phases = screen.getAllByRole('listitem')
    expect(phases[1]).not.toHaveTextContent('SMAP')
    expect(phases[1]).not.toHaveTextContent('SoilGrids')
    expect(phases[2]).toHaveTextContent('Chuva e calor do NASA POWER: 20 anos lidos, dia a dia')
    expect(phases[2]).not.toHaveTextContent('IMERG')
    expect(phases[3]).not.toHaveTextContent('MCD64A1')
    expect(phases[5]).toHaveTextContent('Fazendo a conta')
  })

  it('a fase da chuva diz quantos anos a conta leu, sem número fixo', () => {
    setup({ phase: 6, complete: true, facts: { ...facts, rainYears: 17 } })

    const phases = screen.getAllByRole('listitem')
    expect(phases[2]).toHaveTextContent('Chuva e calor de cada ano')
    expect(phases[2]).toHaveTextContent('Chuva do GPM IMERG e calor do NASA POWER: 17 anos lidos, dia a dia')
    expect(screen.queryByText(/20 anos/)).not.toBeInTheDocument()
  })

  it('sem chuva, histórico nem previsão do outono na API: a fase fica sem o dado, sem "Ainda não conectado" (D2)', () => {
    setup({ phase: 6, complete: true, facts: { ...facts, rainYears: null, historyYears: null, signal: null, burned: null } })

    const phases = screen.getAllByRole('listitem')
    expect(phases[2]).toHaveTextContent('Chuva e calor de cada ano')
    expect(phases[2]).not.toHaveTextContent('anos lidos')
    expect(phases[3].querySelector('strong')).toBeNull()
    expect(phases[4]).not.toHaveTextContent('Previsão do outono')
    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
  })

  it('o clima que vem mostra o clima de 2041 a 2060 lido; sem a previsão do outono, ela não aparece', () => {
    setup({ phase: 6, complete: true, facts: { ...facts, signal: null } })

    const phase = screen.getAllByRole('listitem')[4]
    expect(phase).toHaveTextContent('Clima de 2041 a 2060 lido')
    expect(phase.querySelector('strong')).toHaveTextContent('Clima de 2041 a 2060 lido')
    expect(phase).not.toHaveTextContent('Previsão do outono')
    expect(phase).not.toHaveTextContent('Ainda não conectado')
  })

  it('com o clima do futuro e o sinal do outono, a fase mostra os dois', () => {
    setup({ phase: 6, complete: true })

    const phase = screen.getAllByRole('listitem')[4]
    expect(phase).toHaveTextContent('Clima de 2041 a 2060 lido')
    expect(phase).toHaveTextContent('Previsão do outono (NOAA): sinal de ano seco')
    expect(phase.querySelectorAll('strong')).toHaveLength(2)
  })

  it('sem o CMIP6 no talhão, a fase mostra só a previsão do outono, se houver', () => {
    setup({ phase: 6, complete: true, facts: { ...facts, future: null } })

    const phase = screen.getAllByRole('listitem')[4]
    expect(phase).not.toHaveTextContent('Clima de 2041 a 2060 lido')
    expect(phase).toHaveTextContent('Previsão do outono (NOAA): sinal de ano seco')
    expect(phase).not.toHaveTextContent('Ainda não conectado')
  })

  it('sem o CMIP6 e sem a previsão, a fase fica sem o dado', () => {
    setup({ phase: 6, complete: true, facts: { ...facts, future: null, signal: null } })

    const phase = screen.getAllByRole('listitem')[4]
    expect(phase.querySelector('strong')).toBeNull()
    expect(phase).not.toHaveTextContent('Ainda não conectado')
  })

  it('em inglês, o clima que vem diz o período lido', () => {
    setup({ t: en, lang: 'en', phase: 6, complete: true, facts: { ...facts, signal: null } })

    const phase = screen.getAllByRole('listitem')[4]
    expect(phase).toHaveTextContent('Climate for 2041–2060 read')
    expect(phase).not.toHaveTextContent('Not connected yet')
  })

  it('sinal fraco: deixa esperar mais ou ver a fazenda de exemplo', async () => {
    const props = setup({ weak: true })

    expect(screen.getByText('O sinal está fraco. O satélite continua tentando.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Esperar mais' }))
    expect(props.onWait).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Ver a fazenda de exemplo' })).toHaveAttribute('href', '/exemplo')
  })

  it('erro: mensagem calma e tentar de novo', async () => {
    const props = setup({ status: 'error', facts: null, phase: 0 })

    expect(screen.getByText(/Não conseguimos buscar os dados agora/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(props.onRetry).toHaveBeenCalled()
  })

  it('missão completa: botão para ver o que o satélite viu', () => {
    setup({ phase: 6, complete: true })

    expect(screen.getByRole('heading', { name: 'Missão completa!' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver o que o satélite viu' })).toHaveAttribute(
      'href',
      '/satelite?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
  })

  it('fora da área com dados preparados: oferece a fazenda de exemplo', () => {
    setup({ status: 'outside', facts: null, phase: 0 })

    expect(screen.getByRole('region', { name: 'Ainda não chegamos aí' })).toBeInTheDocument()
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en' })

    expect(screen.getByRole('heading', { level: 1, name: 'Mission: your field' })).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Field found: -18.95 / -48.20')
  })
})
