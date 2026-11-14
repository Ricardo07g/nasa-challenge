import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { Recomendacao } from '../models/recomendacao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { optionsSummary } from '../services/recomendacaoRules'
import { OptionsView, type OptionsViewProps } from './OptionsView'

const point = { lat: -18.9543, lon: -48.1993 }
const nav = {
  label: 'Telas da resposta',
  backTo: '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
  tabs: [
    { to: '/resposta', label: 'Resposta', current: false },
    { to: '/plano', label: 'Plano de 3 anos', current: false },
    { to: '/opcoes', label: 'Todas as opções', current: true },
  ],
}

const summary = (rec: Recomendacao = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')) =>
  optionsSummary(rec, null)

function setup(overrides: Partial<OptionsViewProps> = {}) {
  const props: OptionsViewProps = {
    t: pt,
    nav,
    status: 'ready',
    onRetry: vi.fn(),
    axis: null,
    onAxis: vi.fn(),
    summary: summary(),
    rain: { years: 20, period: { start: '2005', end: '2024' }, skipped: 0 },
    ...overrides,
  }
  render(
    <MemoryRouter>
      <OptionsView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('OptionsView (tela 6)', () => {
  it('um cartão por opção, o 1º em destaque, e "Deixar parado" por último', () => {
    const props = setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Todas as opções' })).toBeInTheDocument()
    const cards = screen.getAllByRole('article')
    expect(cards).toHaveLength(props.summary!.options.length + 1)
    expect(cards[0]).toHaveAttribute('data-highlighted', 'true')
    expect(cards[0]).toHaveTextContent('1º')
    expect(cards[0]).toHaveTextContent('Milho com braquiária')
    expect(cards[0]).toHaveTextContent('Deu certo em 14 de 20 anos')
    expect(within(cards[0]).getByText('Médio')).toBeInTheDocument()
    const fallow = cards[cards.length - 1]
    expect(fallow).toHaveTextContent('Deixar parado')
    expect(fallow).toHaveTextContent('Não depende de chuva')
    expect(fallow).toHaveTextContent('Não rende nada')
    expect(fallow).toHaveTextContent('Fica descoberta')
    expect(screen.getByText(/Cada quadrinho é um ano \(20 anos entre 2005 e 2024\)/)).toBeInTheDocument()
    expect(screen.queryByText(/de 2006 a 2025/)).not.toBeInTheDocument()
  })

  it('sem os detalhes dos anos na API, a legenda marca o que falta como "Ainda não conectado"', () => {
    const rec = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')
    setup({ summary: summary({ ...rec, opcoes: rec.opcoes.map((option) => ({ ...option, anos_detalhe: undefined })) }) })

    const note = screen.getByText('Ainda não conectado').closest('[data-status="not-connected"]')
    expect(note).toHaveTextContent('O que aconteceu em cada ano: Ainda não conectado')
  })

  it('"Colocar na frente quem é melhor em": tocar escolhe; tocar de novo volta à ordem padrão', async () => {
    const props = setup()

    expect(screen.getByText('Colocar na frente quem é melhor em:')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Chuva' }))
    expect(props.onAxis).toHaveBeenCalledWith('chuva')
  })

  it('o eixo escolhido fica marcado e tocar nele de novo limpa', async () => {
    const props = setup({ axis: 'terra' })

    const terra = screen.getByRole('button', { name: 'Terra' })
    expect(terra).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(terra)
    expect(props.onAxis).toHaveBeenCalledWith(null)
  })

  it('avisa o que ficou fora da janela de plantio', () => {
    setup({ summary: summary(buildRecomendacao({ ...point, colheita: 'tarde' }, 'pt')) })

    expect(screen.getByRole('region', { name: 'Fora da janela de plantio' })).toHaveTextContent(
      'Já não dá tempo: Milho sozinho fica fora da janela de plantio.',
    )
  })

  it('opção que não cabe na janela vira cartão laranja com o aviso', () => {
    const rec = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')
    rec.opcoes = rec.opcoes.map((o) => (o.id === 'sorgo' ? { ...o, na_janela: false } : o))
    setup({ summary: summary(rec) })

    const sorgo = screen.getByRole('article', { name: 'Sorgo' })
    expect(sorgo).toHaveAttribute('data-unavailable', 'true')
    expect(sorgo).toHaveTextContent('Fora da janela de plantio')
  })

  it('enquanto carrega e quando dá erro', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <OptionsView t={pt} nav={nav} status="loading" onRetry={vi.fn()} axis={null} onAxis={vi.fn()} summary={null} rain={null} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    unmount()

    const props = setup({ status: 'error', summary: null })
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(props.onRetry).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Ver a fazenda de exemplo' })).toHaveAttribute('href', '/exemplo')
  })

  it('em inglês', () => {
    setup({ t: en, summary: summary(buildRecomendacao({ ...point, colheita: 'meio' }, 'en')) })

    expect(screen.getByRole('heading', { level: 1, name: 'All options' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('1.')
  })

  it('fora da área com dados preparados: explica e oferece a fazenda de exemplo', () => {
    setup({ status: 'outside', summary: null })

    const outside = screen.getByRole('region', { name: 'Ainda não chegamos aí' })
    expect(outside).toHaveTextContent('Por enquanto, os dados estão prontos só para a região')
    expect(screen.getByRole('link', { name: 'Ver a fazenda de exemplo' })).toHaveAttribute('href', '/exemplo')
  })
})
