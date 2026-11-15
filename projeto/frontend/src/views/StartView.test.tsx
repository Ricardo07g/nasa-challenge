import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { ListenSummaryState } from '../controllers/useListenSummary'
import type { StartSourcesState } from '../controllers/useStartController'
import { en } from '../i18n/messages.en'
import { pt, type Messages } from '../i18n/messages.pt'
import { StartView } from './StartView'

function setup({
  t = pt,
  listen = {},
  sources = {},
}: { t?: Messages; listen?: Partial<ListenSummaryState>; sources?: Partial<StartSourcesState> } = {}) {
  const state = {
    listen: { supported: true, speaking: false, toggle: vi.fn(), ...listen },
    sources: { open: false, onOpen: vi.fn(), onClose: vi.fn(), onAllCredits: vi.fn(), ...sources },
  }
  render(
    <MemoryRouter>
      <StartView t={t} listen={state.listen} sources={state.sources} />
    </MemoryRouter>,
  )
  return state
}

describe('StartView (tela Início, tarefa 0052)', () => {
  it('a abertura tem a etiqueta, a pergunta, o slogan, a frase e o "Começar", nessa ordem', () => {
    setup()

    const hero = screen.getByRole('region', { name: 'O que plantar depois da soja?' })
    expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent('O que plantar depois da soja?')
    const text = hero.textContent ?? ''
    const order = [
      'Para quem planta soja no Triângulo Mineiro',
      'O que plantar depois da soja?',
      'Do espaço até a raiz.',
      'O satélite da NASA olha a chuva de muitos anos na sua lavoura. Veja a melhor opção.',
      'Ouvir resumo',
      'Começar',
    ].map((part) => text.indexOf(part))
    expect(order.every((index) => index >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(within(hero).getByRole('link', { name: 'Começar' })).toHaveAttribute('href', '/onde')
  })

  it('o que saiu da tela: exemplo pronto, "2 perguntas", o título dos passos, "Da NASA para a sua lavoura" e o MVP', () => {
    setup()

    expect(screen.queryByRole('link', { name: /exemplo/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/2 perguntas/)).not.toBeInTheDocument()
    expect(screen.queryByText('Uma boa próxima safra começa com uma boa escolha.')).not.toBeInTheDocument()
    expect(screen.queryByText('Da NASA para a sua lavoura')).not.toBeInTheDocument()
    expect(screen.queryByText(/MVP/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Uberlândia/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Telegram/)).not.toBeInTheDocument()
  })

  it('os 3 passos ficam numa faixa só, dentro da abertura', () => {
    setup()

    const hero = screen.getByRole('region', { name: 'O que plantar depois da soja?' })
    expect(within(hero).getByRole('heading', { level: 2, name: 'Como funciona' })).toBeInTheDocument()
    const steps = within(within(hero).getByRole('list')).getAllByRole('listitem')
    expect(steps).toHaveLength(3)
    expect(within(steps[0]).getByRole('heading', { level: 3, name: 'Marque a lavoura' })).toBeInTheDocument()
    expect(steps[0]).toHaveTextContent('Um ponto no mapa.')
    expect(steps[1]).toHaveTextContent('Diga quando colhe')
    expect(steps[1]).toHaveTextContent('A época da colheita da soja.')
    expect(steps[2]).toHaveTextContent('Veja a resposta')
    expect(steps[2]).toHaveTextContent('O melhor caminho para a sua terra.')
  })

  it('a foto (gerada por IA) leva a marca d\'água "Imagem gerada por IA"', () => {
    setup()

    expect(screen.getByRole('img', { name: 'Lavoura no Triângulo Mineiro ao amanhecer' })).toBeInTheDocument()
    expect(screen.getByText('Imagem gerada por IA')).toBeInTheDocument()
  })

  it('o selo "Dados da NASA · Triângulo Mineiro · MG" é um botão que abre o modal "De onde vêm os dados"', async () => {
    const state = setup()

    const seal = screen.getByRole('button', { name: 'Dados da NASA Triângulo Mineiro · MG' })
    expect(seal).toHaveAttribute('aria-haspopup', 'dialog')
    await userEvent.click(seal)

    expect(state.sources.onOpen).toHaveBeenCalledTimes(1)
    // NASA só como texto da fonte: nada de logo (a única imagem da tela é a foto da lavoura).
    expect(screen.getAllByRole('img')).toHaveLength(1)
  })

  it('o modal "De onde vêm os dados" mostra as 4 fontes, o quadro e o link para os créditos', async () => {
    const state = setup({ sources: { open: true } })

    const dialog = screen.getByRole('dialog', { name: 'De onde vêm os dados' })
    expect(dialog).toHaveTextContent('20 anos de satélite (2005–2024) no ponto da sua lavoura.')
    const rows = within(within(dialog).getByRole('list')).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      'ChuvaGPM IMERG · NASA · chuva de cada dia',
      'Calor e água que a lavoura gastaNASA POWER · temperatura, sol e vento',
      'SoloSoilGrids · quanta água a terra guarda',
      'Clima de 2041 a 2060NEX-GDDP-CMIP6 · NASA',
    ])
    expect(dialog).toHaveTextContent(
      'Nenhum número é inventado. Se não há dado para o seu ponto, aquela parte não aparece.',
    )

    await userEvent.click(within(dialog).getByRole('button', { name: 'Todas as fontes e créditos' }))
    expect(state.sources.onAllCredits).toHaveBeenCalledTimes(1)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }))
    expect(state.sources.onClose).toHaveBeenCalled()
  })

  it('"Ouvir resumo" pede para falar o resumo', async () => {
    const state = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Ouvir resumo' }))
    expect(state.listen.toggle).toHaveBeenCalledTimes(1)
  })

  it('enquanto fala, o link vira "Parar" com aria-pressed', () => {
    setup({ listen: { speaking: true } })

    expect(screen.getByRole('button', { name: 'Parar' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('sem voz no navegador, o "Ouvir resumo" não aparece', () => {
    setup({ listen: { supported: false } })

    expect(screen.queryByRole('button', { name: 'Ouvir resumo' })).not.toBeInTheDocument()
  })

  it('a faixa do agrônomo leva para "Como a conta é feita"', () => {
    setup()

    const agro = screen.getByRole('region', { name: 'É agrônomo(a) ou técnico(a)?' })
    expect(agro).toHaveTextContent('É agrônomo(a) ou técnico(a)? Veja as regras, os pesos e a fonte de cada número.')
    expect(within(agro).getByRole('link', { name: 'Como a conta é feita' })).toHaveAttribute('href', '/como-funciona')
  })

  it('a tela à vista não traz número que pareça medido (os "20 anos" ficam no modal das fontes)', () => {
    setup()

    expect(screen.queryByText(/20 anos/)).not.toBeInTheDocument()
  })

  it('em inglês', () => {
    setup({ t: en, sources: { open: true } })

    expect(screen.getByRole('heading', { level: 1, name: 'What to plant after soybeans?' })).toBeInTheDocument()
    expect(screen.getByText('For soybean growers in Triângulo Mineiro, Brazil')).toBeInTheDocument()
    expect(screen.getByText('Eyes on the sky, roots in the ground.')).toBeInTheDocument()
    expect(screen.queryByText(/Portuguese for/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/onde')
    expect(screen.getByRole('button', { name: 'Listen to summary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'NASA data Triângulo Mineiro · MG' })).toBeInTheDocument()
    expect(screen.getByText('AI-generated image')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Tell us when you harvest' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'How the math works' })).toBeInTheDocument()
    const dialog = screen.getByRole('dialog', { name: 'Where the data comes from' })
    expect(within(dialog).getByRole('button', { name: 'All sources and credits' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})
