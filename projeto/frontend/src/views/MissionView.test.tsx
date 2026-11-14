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
  historyYears: 10,
  signal: 'seco' as const,
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

    expect(screen.getAllByRole('listitem')[4]).toHaveTextContent('Previsão do outono: sinal de ano seco')
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

  it('sem histórico nem previsão do outono na API, diz isso em vez de inventar', () => {
    setup({ phase: 6, complete: true, facts: { ...facts, historyYears: null, signal: null } })

    const phases = screen.getAllByRole('listitem')
    expect(phases[3]).toHaveTextContent('Sem histórico do satélite para esta área')
    expect(phases[4]).toHaveTextContent('Previsão do outono ainda não disponível')
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
