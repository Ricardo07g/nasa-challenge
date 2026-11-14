import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { createMockPastSeasonRepository } from '../repositories/pastSeasonRepository'
import { PastSeasonView, type PastSeasonViewProps } from './PastSeasonView'

const repository = createMockPastSeasonRepository(0)
const point = { lat: -18.9543, lon: -48.1993 }

async function setup(overrides: Partial<PastSeasonViewProps> = {}) {
  const props: PastSeasonViewProps = {
    t: pt,
    lang: 'pt',
    status: 'ready',
    onRetry: vi.fn(),
    backTo: '/plano?lat=-18.9543&lon=-48.1993&colheita=meio',
    year: 2024,
    onYear: vi.fn(),
    season: await repository.get(point, 2024, 'pt'),
    sampleData: true,
    ...overrides,
  }
  render(
    <MemoryRouter>
      <PastSeasonView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('PastSeasonView (replay da safra passada, P4)', () => {
  it('linha do tempo de 2024 com os avisos que teriam chegado', async () => {
    await setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Como teria sido a safrinha de 2024' })).toBeInTheDocument()
    expect(screen.getByText(/Repetimos a chuva e o calor de 2024/)).toBeInTheDocument()
    const events = screen.getAllByRole('listitem')
    expect(events).toHaveLength(7)
    expect(events[0]).toHaveTextContent('18 de fevereiroSemeadura do milho com braquiária.')
    expect(events[2]).toHaveAttribute('data-warning', 'true')
    expect(events[2]).toHaveTextContent('Aviso: 10 dias sem chuva perto da fase que mais precisa de água.')
    expect(screen.queryByText('Nenhum aviso nesta safra.')).not.toBeInTheDocument()
  })

  it('escolher o ano: 2024 seco, 2023 bom', async () => {
    const props = await setup()

    expect(screen.getByRole('button', { name: '2024 · ano seco' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: '2023 · ano bom' }))
    expect(props.onYear).toHaveBeenCalledWith(2023)
  })

  it('safra sem avisos diz isso', async () => {
    await setup({ year: 2023, season: await repository.get(point, 2023, 'pt') })

    expect(screen.getByText('Nenhum aviso nesta safra.')).toBeInTheDocument()
  })

  it('com dados de exemplo, avisa que os valores são de exemplo; Voltar leva ao plano', async () => {
    await setup()

    expect(screen.getByText('Valores de exemplo. No app, o ano e as datas vêm dos dados reais.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute(
      'href',
      '/plano?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
  })

  it('fora da área com dados preparados', async () => {
    await setup({ status: 'outside', season: null })

    expect(screen.getByRole('region', { name: 'Ainda não chegamos aí' })).toBeInTheDocument()
  })

  it('em inglês', async () => {
    await setup({ t: en, lang: 'en', season: await repository.get(point, 2024, 'en') })

    expect(screen.getByRole('heading', { level: 1, name: 'How the 2024 second crop would have gone' })).toBeInTheDocument()
  })
})
