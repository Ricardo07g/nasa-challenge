import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { Recomendacao } from '../models/recomendacao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { optionsForObjective } from '../services/suggestionService'
import { OptionsView, type OptionsViewProps } from './OptionsView'

const point = { lat: -18.9543, lon: -48.1993 }
const nav = {
  label: 'Telas da resposta',
  backTo: '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
  tabs: [
    { to: '/resposta', label: 'Sugestão', current: false },
    { to: '/opcoes', label: 'Comparar', current: true },
    { to: '/plano', label: 'Plano de 3 anos', current: false },
  ],
  objective: null,
  chooseObjective: vi.fn(),
}

const summary = (rec: Recomendacao = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')) =>
  optionsForObjective(rec, null)

function setup(overrides: Partial<OptionsViewProps> = {}) {
  const props: OptionsViewProps = {
    t: pt,
    nav,
    status: 'ready',
    onRetry: vi.fn(),
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

describe('OptionsView (aba Comparar)', () => {
  it('um cartão por opção, o 1º em destaque, e "Deixar parado" por último', () => {
    const props = setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Comparar' })).toBeInTheDocument()
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
    expect(fallow).toHaveTextContent('Não dá grão')
    expect(fallow).toHaveTextContent('Fica descoberta')
    expect(screen.getByText(/Cada quadrinho é um ano \(20 anos entre 2005 e 2024\)/)).toBeInTheDocument()
    expect(screen.queryByText(/de 2006 a 2025/)).not.toBeInTheDocument()
  })

  it('cada opção mostra o clima de 2041–2060 no mesmo formato da resposta, logo depois da chuva', () => {
    setup()

    const [first, second] = screen.getAllByRole('article')
    expect(first).toHaveTextContent('Clima 2041–2060Daria certo em 12 de 20 anos (de 10 a 13, conforme o modelo)')
    expect(first.textContent).toMatch(/Deu certo em 14 de 20 anos.*Clima 2041–2060.*Dá grão para vender/)
    expect(second).toHaveTextContent('Sorgo')
    expect(second).toHaveTextContent('Clima 2041–2060Daria certo em 15 de 20 anos (de 13 a 16, conforme o modelo)')
  })

  it('quando todos os modelos dão o mesmo número, a opção fica sem a faixa', () => {
    const rec = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')
    const futuro = { anos_bons_media: 19, anos_bons_min: 19, anos_bons_max: 19, modelos: 3, cenario: 'ssp245' }
    setup({ summary: summary({ ...rec, opcoes: rec.opcoes.map((o) => (o.id === 'sorgo' ? { ...o, futuro } : o)) }) })

    const sorgo = screen.getByRole('article', { name: 'Sorgo' })
    expect(sorgo).toHaveTextContent('Clima 2041–2060Daria certo em 19 de 20 anos')
    expect(sorgo).not.toHaveTextContent('conforme o modelo')
  })

  it('cada opção mostra a renda só com fatos: dá grão ou não e o risco, sem reais (tarefa 0040)', () => {
    setup()

    const sorgo = screen.getByRole('article', { name: 'Sorgo' })
    expect(sorgo).toHaveTextContent(
      'RendaDá grão para venderRisco de perder a lavoura: faltou água ou fez calor em 3 de 20 anos.',
    )
    expect(screen.getByRole('article', { name: 'Crotalária' })).toHaveTextContent('Não dá grão: é investimento na terra')
    expect(screen.queryByText('Dinheiro')).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('R$')
  })

  it('sem o dado do CMIP6, a linha do futuro de cada opção não aparece (decisão D2)', () => {
    const rec = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')
    setup({ summary: summary({ ...rec, opcoes: rec.opcoes.map((option) => ({ ...option, futuro: null })) }) })

    const sorgo = screen.getByRole('article', { name: 'Sorgo' })
    expect(sorgo).not.toHaveTextContent('Clima 2041–2060')
    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
  })

  it('sem os detalhes dos anos na API, nada avisa o que falta (decisão D2)', () => {
    const rec = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')
    setup({ summary: summary({ ...rec, opcoes: rec.opcoes.map((option) => ({ ...option, anos_detalhe: undefined })) }) })

    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
    expect(screen.queryByText(/O que aconteceu em cada ano/)).not.toBeInTheDocument()
  })

  it('"O que você quer mais?" no topo, no lugar do "Colocar na frente" (tarefa 0044)', async () => {
    const props = setup()

    expect(screen.queryByText('Colocar na frente quem é melhor em:')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mais segurança' }))
    expect(props.nav.chooseObjective).toHaveBeenCalledWith('seguranca')
  })

  it('cada cartão tem a imagem da planta, o selo de sede e a linha Água', () => {
    setup()

    const sorgo = screen.getByRole('article', { name: 'Sorgo' })
    expect(within(sorgo).getByRole('img', { name: 'Desenho da planta: Sorgo' })).toBeInTheDocument()
    expect(within(sorgo).getByText('Sede: água média')).toBeInTheDocument()
    expect(sorgo).toHaveTextContent('ÁguaPrecisa de 303 mm · Costuma chover 398 mm')
    expect(sorgo).toHaveTextContent('Falta 83 mm em ano normal e 114 mm em ano seco')
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
        <OptionsView t={pt} nav={nav} status="loading" onRetry={vi.fn()} summary={null} rain={null} />
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

    expect(screen.getByRole('heading', { level: 1, name: 'Compare' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('1.')
    expect(screen.getAllByRole('article')[0]).toHaveTextContent(
      '2041–2060 climateWould work in 12 of 20 years (10 to 13, depending on the model)',
    )
  })

  it('em inglês, sem o dado do CMIP6, a linha do futuro não aparece', () => {
    const rec = buildRecomendacao({ ...point, colheita: 'meio' }, 'en')
    setup({ t: en, summary: summary({ ...rec, opcoes: rec.opcoes.map((option) => ({ ...option, futuro: null })) }) })

    expect(screen.getAllByRole('article')[0]).not.toHaveTextContent('2041–2060 climate')
    expect(screen.queryByText(/Not connected yet/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('article')[0]).toHaveTextContent('IncomeGives grain to sell')
  })

  it('fora da área com dados preparados: explica e oferece a fazenda de exemplo', () => {
    setup({ status: 'outside', summary: null })

    const outside = screen.getByRole('region', { name: 'Ainda não chegamos aí' })
    expect(outside).toHaveTextContent('Por enquanto, os dados estão prontos só para a região')
    expect(screen.getByRole('link', { name: 'Ver a fazenda de exemplo' })).toHaveAttribute('href', '/exemplo')
  })
})
