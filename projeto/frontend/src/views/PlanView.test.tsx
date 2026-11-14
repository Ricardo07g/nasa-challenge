import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { buildPlan } from '../services/recomendacaoRules'
import { PlanView, type PlanViewProps } from './PlanView'

const rec = buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')
const nav = {
  label: 'Telas da resposta',
  backTo: '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
  tabs: [
    { to: '/resposta', label: 'Resposta', current: false },
    { to: '/plano', label: 'Plano de 3 anos', current: true },
    { to: '/opcoes', label: 'Todas as opções', current: false },
  ],
}

function setup(overrides: Partial<PlanViewProps> = {}) {
  const props: PlanViewProps = {
    t: pt,
    nav,
    status: 'ready',
    onRetry: vi.fn(),
    scenario: 'normal',
    onScenario: vi.fn(),
    area: '50',
    onArea: vi.fn(),
    plan: buildPlan(rec, 'normal'),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <PlanView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('PlanView (tela 7)', () => {
  it('linha do tempo com um ano por bloco', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Plano de 3 anos' })).toBeInTheDocument()
    expect(screen.getByText('O que plantar depois da soja, um ano de cada vez.')).toBeInTheDocument()
    const timeline = screen.getByRole('list', { name: 'Plano ano a ano' })
    expect(timeline.querySelectorAll('li')).toHaveLength(3)
    expect(timeline).toHaveTextContent('2027Milho com braquiáriaDá grão e cobre a terra.')
    expect(timeline).toHaveTextContent('2029SorgoDá grão com menos risco de seca.')
  })

  it('ano normal marcado, com o resumo do plano e como é hoje', () => {
    setup()

    expect(screen.getByRole('button', { name: 'Ano normal' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Chuva parecida com a média dos últimos 20 anos.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Com plano' })).toHaveTextContent(
      'Terra coberta nos 3 anos · Grão em 2 de 3 anos',
    )
    expect(screen.getByRole('region', { name: 'Como é hoje' })).toHaveTextContent('Terra descoberta em metade dos anos')
  })

  it('ano seco: a troca aparece na linha do tempo e é explicada', () => {
    setup({ scenario: 'seco', plan: buildPlan(rec, 'seco') })

    expect(screen.getByRole('list', { name: 'Plano ano a ano' })).toHaveTextContent(
      '2027SorgoNo lugar de milho com braquiária: aguenta mais a seca.',
    )
    expect(screen.getByText(/Repetimos os anos mais secos dos últimos 20/)).toHaveTextContent(
      'O plano troca milho com braquiária de 2027 por sorgo.',
    )
  })

  it('tocar em "Ano seco" e em "100 ha" chama o controller', async () => {
    const props = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Ano seco' }))
    await userEvent.click(screen.getByRole('button', { name: '100 ha' }))

    expect(props.onScenario).toHaveBeenCalledWith('seco')
    expect(props.onArea).toHaveBeenCalledWith('100')
  })

  it('"Comece por um pedaço": a frase acompanha a área', () => {
    setup()
    expect(screen.getByText('O plano em 50 hectares. O resto fica como hoje, para você comparar.')).toBeInTheDocument()
  })

  it('"Tudo" é o plano na área toda', () => {
    setup({ area: 'all' })
    expect(screen.getByText('O plano na área toda.')).toBeInTheDocument()
  })

  it('o ganho na soja seguinte, com a nota de que a referência é ilustrativa', () => {
    setup()

    expect(screen.getByRole('heading', { name: 'O ganho vem na soja seguinte' })).toBeInTheDocument()
    expect(screen.getByText('Referência ilustrativa; estudo a confirmar.')).toBeInTheDocument()
  })

  it('enquanto carrega e quando dá erro', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <PlanView
          t={pt}
          nav={nav}
          status="loading"
          onRetry={vi.fn()}
          scenario="normal"
          onScenario={vi.fn()}
          area="50"
          onArea={vi.fn()}
          plan={null}
        />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    unmount()

    const props = setup({ status: 'error', plan: null })
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(props.onRetry).toHaveBeenCalled()
  })

  it('em inglês', () => {
    setup({ t: en, scenario: 'seco', plan: buildPlan(rec, 'seco') })

    expect(screen.getByRole('heading', { level: 1, name: '3-year plan' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: /year/i })).toHaveTextContent('Instead of corn with brachiaria')
  })
})
