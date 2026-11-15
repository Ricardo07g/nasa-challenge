import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { buildRaioX } from '../repositories/mocks/raioXFixture'
import { alertList } from '../services/raioXService'
import { PlanningView, type PlanningViewProps } from './PlanningView'

const RAIO = buildRaioX({ lat: -18.9543, lon: -48.1993, colheita: 'tarde' }, 'pt')
const ALERTS = alertList({
  ...RAIO,
  alertas: {
    geada: { anos: [2021], total_anos: 20, temp_c: 3, menor_temp_c: 1.2, fonte: 'nasa_power' },
    chuva_forte: RAIO.alertas.chuva_forte,
    fogo: { anos: [2016, 2018, 2019, 2020, 2024], total_anos: 10, raio_km: 5, fonte: 'MODIS MCD64A1' },
  },
})

function setup(overrides: Partial<PlanningViewProps> = {}) {
  const props: PlanningViewProps = {
    t: pt,
    lang: 'pt',
    backTo: '/resposta?lat=-18.9543&lon=-48.1993&colheita=tarde',
    status: 'ready',
    onRetry: vi.fn(),
    listen: { supported: true, speaking: false, toggle: vi.fn() },
    alerts: ALERTS,
    cards: RAIO.cartoes,
    rain: null,
    climate: null,
    answerTo: '/resposta?lat=-18.9543&lon=-48.1993&colheita=tarde',
    ...overrides,
  }
  render(
    <MemoryRouter>
      <PlanningView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('PlanningView (/planejamento: os blocos que saíram do raio-X)', () => {
  it('Voltar para a resposta, um título simples e o "Ouvir resumo"', async () => {
    const props = setup()

    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', props.backTo)
    expect(screen.getByRole('heading', { level: 1, name: 'Seu planejamento' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ouvir resumo' }))
    expect(props.listen.toggle).toHaveBeenCalled()
  })

  it('"Alertas da sua área": geada, chuva forte e fogo, com o "Saiba mais" em nova aba', () => {
    setup()

    const section = screen.getByRole('region', { name: 'Alertas da sua área' })
    expect(within(section).getByRole('heading', { name: 'Geada' })).toBeInTheDocument()
    expect(within(section).getByText('Em 1 de 20 anos, a mínima chegou a 3 °C ou menos entre maio e julho (NASA POWER).')).toBeInTheDocument()
    expect(within(section).getByRole('heading', { name: 'Chuva forte' })).toBeInTheDocument()
    expect(within(section).getByText('Houve fogo a até 5 km do seu ponto em 5 de 10 anos (MODIS, NASA).')).toBeInTheDocument()
    const fire = within(section).getByRole('link', { name: /Saiba mais: Fogo na palha/ })
    expect(fire).toHaveAttribute('href', '/guia/fogo-na-palha')
    expect(fire).toHaveAttribute('target', '_blank')
  })

  it('sem alerta, a seção não aparece', () => {
    setup({ alerts: [] })

    expect(screen.queryByRole('region', { name: 'Alertas da sua área' })).not.toBeInTheDocument()
  })

  it('"20 anos de chuva" e "Clima 2041–2060", com "ver na sugestão"', () => {
    const props = setup()

    expect(screen.getByRole('heading', { name: '20 anos de chuva' })).toBeInTheDocument()
    expect(screen.getByText('16 de 20')).toBeInTheDocument()
    expect(screen.getByText('anos em que milho com braquiária deu certo (GPM IMERG e NASA POWER).')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Clima 2041–2060' })).toBeInTheDocument()
    expect(screen.getByText('Chuva de março a maio: -4,5%')).toBeInTheDocument()
    expect(screen.getByText('Máxima: +1,6 °C')).toBeInTheDocument()
    expect(screen.getByText('2 de 3 modelos indicam menos chuva; 3 de 3, mais calor.')).toBeInTheDocument()
    const links = screen.getAllByRole('link', { name: 'ver na sugestão' })
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', props.answerTo)
  })

  it('sem o raio-X, os cartões de antes: anos de chuva e clima, com o ✓ de pronto', () => {
    setup({ cards: null, alerts: [], rain: { years: 20, period: { start: '2005', end: '2024' }, skipped: 0 }, climate: { period: { start: '2041', end: '2060' } } })

    expect(screen.getByRole('heading', { name: '20 anos de chuva daqui' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Clima dos próximos anos' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Pronto' })).toHaveLength(2)
  })

  it('carregando e fora da área', () => {
    const { unmount } = render(
      <MemoryRouter>
        <PlanningView {...setupProps({ status: 'loading' })} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Buscando os dados da sua área…')).toBeInTheDocument()
    unmount()
    render(
      <MemoryRouter>
        <PlanningView {...setupProps({ status: 'outside' })} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Ainda não chegamos aí')).toBeInTheDocument()
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en' })

    expect(screen.getByRole('heading', { level: 1, name: 'Your planning' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Alerts for your area' })).toBeInTheDocument()
  })
})

function setupProps(overrides: Partial<PlanningViewProps>): PlanningViewProps {
  return {
    t: pt,
    lang: 'pt',
    backTo: '/resposta',
    status: 'ready',
    onRetry: vi.fn(),
    listen: { supported: false, speaking: false, toggle: vi.fn() },
    alerts: [],
    cards: null,
    rain: null,
    climate: null,
    answerTo: '/resposta',
    ...overrides,
  }
}
