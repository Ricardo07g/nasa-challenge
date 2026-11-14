import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { SatelliteView, type SatelliteViewProps } from './SatelliteView'

function setup(overrides: Partial<SatelliteViewProps> = {}) {
  const props: SatelliteViewProps = {
    t: pt,
    backTo: '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
    status: 'ready',
    onRetry: vi.fn(),
    history: { idle: 1, planted: 1, total: 2, situations: ['parado', 'plantou'], years: ['2024', '2025'] },
    rain: { start: '2006', end: '2025' },
    soil: { textura: 'argiloso', source: 'map' },
    soilOpen: false,
    onToggleSoil: vi.fn(),
    onChooseSoil: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <SatelliteView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('SatelliteView (tela 4)', () => {
  it('mostra os 4 cartões do que o satélite viu, cada um com o ✓ de pronto', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Pronto. O satélite já viu o resto.' })).toBeInTheDocument()
    expect(screen.getByText('Você não precisa preencher mais nada.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sua área ficou parada em 1 de 2 anos' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Plantou em 1 de 2 anos' })).toHaveTextContent('20242025')
    expect(screen.getByText('Ficou parado')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '20 anos de chuva daqui' })).toBeInTheDocument()
    expect(screen.getByText('De 2006 a 2025, dia por dia.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Terra argilosa' })).toBeInTheDocument()
    expect(screen.getByText('Do mapa de solos.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Clima dos próximos anos' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Pronto' })).toHaveLength(4)
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute(
      'href',
      '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
  })

  it('sem histórico do satélite, o cartão do histórico some', () => {
    setup({ history: null })

    expect(screen.queryByRole('heading', { name: /ficou parada/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Pronto' })).toHaveLength(3)
  })

  it('"Não é? Trocar" chama o controller', async () => {
    const props = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Não é? Trocar' }))

    expect(props.onToggleSoil).toHaveBeenCalled()
  })

  it('com a escolha aberta, mostra as 3 terras com a atual marcada', async () => {
    const props = setup({ soilOpen: true })

    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveAttribute('aria-expanded', 'true')
    const group = screen.getByRole('group', { name: 'Qual é a sua terra?' })
    expect(group.querySelectorAll('button')).toHaveLength(3)
    expect(screen.getByRole('button', { name: /Argilosa/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: /Arenosa/ }))

    expect(props.onChooseSoil).toHaveBeenCalledWith('arenoso')
  })

  it('diz de onde veio a terra', () => {
    setup({ soil: { textura: 'arenoso', source: 'user' } })
    expect(screen.getByText('Você escolheu.')).toBeInTheDocument()
  })

  it('"Ver o que plantar" segue para a resposta', async () => {
    const props = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Ver o que plantar' }))

    expect(props.onConfirm).toHaveBeenCalled()
  })

  it('enquanto carrega, avisa e mostra os cartões vazios (nunca tela branca)', () => {
    setup({ status: 'loading' })

    expect(screen.getByRole('status')).toHaveTextContent('Buscando dados do satélite…')
    expect(screen.queryByRole('button', { name: 'Ver o que plantar' })).not.toBeInTheDocument()
  })

  it('se não vier, explica, tenta de novo ou abre o exemplo', async () => {
    const props = setup({ status: 'error' })

    expect(screen.getByRole('alert')).toHaveTextContent('Não conseguimos buscar os dados agora.')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(props.onRetry).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Ver a fazenda de exemplo' })).toHaveAttribute('href', '/exemplo')
  })

  it('em inglês', () => {
    setup({ t: en })

    expect(screen.getByRole('heading', { level: 1, name: 'Done. The satellite saw the rest.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Clayey soil' })).toBeInTheDocument()
  })
})
