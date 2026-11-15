import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { usePlanningController } from '../controllers/usePlanningController'
import { I18nProvider } from '../i18n/I18nProvider'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { useI18n } from '../i18n/useI18n'
import type { PlanoParams, PlanoSugestaoParams } from '../models/plano'
import { buildRecomendacao, buildTalhao } from '../repositories/mocks/fixtures'
import { buildPlano, buildSugestao } from '../repositories/mocks/mockPlano'
import { buildRaioX } from '../repositories/mocks/raioXFixture'
import type { FarmService } from '../services/farmService'
import type { PlanService } from '../services/planService'
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
    report: null,
    onPrint: vi.fn(),
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
    report: null,
    onPrint: vi.fn(),
    ...overrides,
  }
}

const point = { lat: -18.9543, lon: -48.1993 }
const flow = 'lat=-18.9543&lon=-48.1993&colheita=tarde&data=2027-03-03'

function planningDeps() {
  const farm: FarmService = {
    talhao: vi.fn(() => Promise.resolve(buildTalhao(point, 'pt'))),
    recomendacao: vi.fn(() => Promise.resolve(buildRecomendacao({ ...point, colheita: 'tarde' }, 'pt'))),
  }
  const plan: PlanService = {
    suggest: vi.fn((params: PlanoSugestaoParams) => Promise.resolve(buildSugestao(params, 'pt'))),
    evaluate: vi.fn((params: PlanoParams) => Promise.resolve(buildPlano(params, 'pt'))),
  }
  return {
    farm,
    plan,
    raioX: { get: vi.fn((params) => Promise.resolve(buildRaioX(params, 'pt'))) },
    speech: { isSupported: () => false, speak: vi.fn(), stop: vi.fn() },
    print: vi.fn(),
    today: () => '2026-11-15',
  }
}

/** A tela inteira, com o controller de verdade e os services falsos. */
function renderPlanning(url: string, d = planningDeps(), lang: 'pt' | 'en' = 'pt') {
  function Screen() {
    const { lang: current, messages: t } = useI18n()
    const state = usePlanningController(d)
    return (
      <PlanningView
        t={t}
        lang={current}
        backTo={state.backTo}
        status={state.status}
        onRetry={state.retry}
        listen={state.listen}
        alerts={state.alerts}
        cards={state.cards}
        rain={state.rain}
        climate={state.climate}
        answerTo={state.answerTo}
        report={state.report}
        onPrint={state.print}
      />
    )
  }
  render(
    <I18nProvider initialLang={lang}>
      <MemoryRouter initialEntries={[url]}>
        <Screen />
      </MemoryRouter>
    </I18nProvider>,
  )
  return d
}

describe('PlanningView: relatório para imprimir (veio da tela 5, pacote 3)', () => {
  it('fica no <body>, escondido na tela, com as 6 seções', async () => {
    renderPlanning(`/planejamento?${flow}&pensa=sorgo&safras=2024:milho_braquiaria,2025:pousio`)
    await screen.findByRole('heading', { level: 1 })
    await waitFor(() => expect(document.querySelector('[data-print-report]')).not.toBeNull())

    const report = document.querySelector('[data-print-report]') as HTMLElement
    expect(report.parentElement).toBe(document.body)
    expect(report).toHaveAttribute('hidden')
    expect(within(report).getByRole('heading', { level: 1, hidden: true })).toHaveTextContent('Relatório do planejamento')
    expect(report.querySelector('header')).toBeNull()
    expect(report).toHaveTextContent('Sua lavoura · -18.9543, -48.1993')
    expect(report).toHaveTextContent('Gerado em 15 de novembro de 2026 pelo Raiz Orbital')
    for (const title of ['1. Sua terra', '2. Suas últimas safras', '3. Opções comparadas', '4. Plano de 3 anos', '5. E se o ano vier seco?', '6. Fontes']) {
      expect(report).toHaveTextContent(title)
    }
    expect(report).toHaveTextContent('2026/27 (o que você pensava plantar)Sorgo')
    expect(report).toHaveTextContent('2025/26não preenchido')
    expect(report).toHaveTextContent('Não substitui o seu agrônomo')
  })

  it('em inglês', async () => {
    renderPlanning(`/planejamento?${flow}`, planningDeps(), 'en')
    await screen.findByRole('heading', { level: 1, name: 'Your planning' })
    await waitFor(() => expect(document.querySelector('[data-print-report]')).toHaveTextContent('Planning report'))
    expect(document.querySelector('[data-print-report]')).toHaveTextContent('6. Sources')
  })

  it('"Imprimir relatório" fica nesta tela e chama a impressão', async () => {
    const d = renderPlanning(`/planejamento?${flow}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Imprimir relatório' }))
    expect(d.print).toHaveBeenCalledTimes(1)
  })
})
