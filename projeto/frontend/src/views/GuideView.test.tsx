import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { GuideSummary } from '../models/guide'
import { GuideView, type GuideViewProps } from './GuideView'

const summary = (slug: string, title: string, theme: GuideSummary['theme'], extra: Partial<GuideSummary> = {}): GuideSummary => ({
  slug,
  title,
  summary: `Resumo de ${title}.`,
  theme,
  draft: false,
  plant: null,
  minutes: 2,
  related: [],
  ...extra,
})

const sorgo = summary('sorgo', 'Sorgo', 'cultures', { draft: true, plant: 'sorgo', summary: 'Dá grão e aguenta mais seca que o milho.' })
const veranico = summary('veranico', 'Veranico', 'climate', { minutes: 1 })
const raioX = summary('raio-x', 'Como ler o raio-X da sua terra', 'climate')
const erosao = summary('como-evitar-erosao', 'Como evitar erosão', 'soil', { draft: true })

function setup(overrides: Partial<GuideViewProps> = {}) {
  const props: GuideViewProps = {
    t: pt,
    lang: 'pt',
    backTo: '/',
    onBack: vi.fn(),
    filters: { theme: 'all', query: '' },
    onQuery: vi.fn(),
    onClear: vi.fn(),
    onTheme: vi.fn(),
    themes: [
      { key: 'all', count: 27 },
      { key: 'cultures', count: 6 },
      { key: 'planting', count: 4 },
      { key: 'soil', count: 5 },
      { key: 'climate', count: 9 },
      { key: 'safety', count: 3 },
    ],
    searching: false,
    featured: [raioX],
    groups: [
      { theme: 'cultures', articles: [sorgo] },
      { theme: 'climate', articles: [veranico, raioX] },
    ],
    results: [],
    linkQuery: '',
    listen: { supported: true, speaking: false, toggle: vi.fn() },
    ...overrides,
  }
  render(
    <MemoryRouter>
      <GuideView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('GuideView (início do Guia, tela 8)', () => {
  it('o "← Voltar", o título, a linha de apoio e o "Ouvir resumo"', async () => {
    const props = setup()

    const back = screen.getByRole('link', { name: /Voltar/ })
    expect(back).toHaveAttribute('data-back-button')
    expect(back).toHaveAttribute('href', '/')
    await userEvent.click(back)
    expect(props.onBack).toHaveBeenCalled()
    expect(screen.getByRole('heading', { level: 1, name: 'Guia' })).toBeInTheDocument()
    expect(screen.getByText('Respostas curtas para as dúvidas da lavoura, com as fontes.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ouvir resumo' }))
    expect(props.listen.toggle).toHaveBeenCalled()
  })

  it('a frase do MVP saiu do Guia', () => {
    setup()
    expect(screen.queryByText(/Nesta primeira versão/)).not.toBeInTheDocument()
  })

  it('a busca grande com a lupa, o texto de exemplo e o "×" só com busca', async () => {
    const props = setup()
    const box = screen.getByRole('searchbox', { name: 'Buscar no Guia' })

    expect(box).toHaveAttribute('placeholder', 'Buscar: veranico, palhada…')
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).not.toBeInTheDocument()
    await userEvent.type(box, 'v')
    expect(props.onQuery).toHaveBeenCalledWith('v')
  })

  it('o "×" limpa a busca', async () => {
    const props = setup({ searching: true, filters: { theme: 'all', query: 'chuva' } })
    await userEvent.click(screen.getByRole('button', { name: 'Limpar busca' }))
    expect(props.onClear).toHaveBeenCalled()
  })

  it('as pílulas dos temas com a contagem e o aria-pressed na escolhida', async () => {
    const props = setup()
    const themes = screen.getByRole('group', { name: 'Temas' })

    expect(within(themes).getByRole('button', { name: 'Todos 27' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(themes).getByRole('button', { name: 'Culturas 6' })).toHaveAttribute('aria-pressed', 'false')
    expect(within(themes).getByRole('button', { name: 'Cuidar da terra 5' })).toBeInTheDocument()
    await userEvent.click(within(themes).getByRole('button', { name: 'Clima, água e dados 9' }))
    expect(props.onTheme).toHaveBeenCalledWith('climate')
  })

  it('"Comece por aqui" com os destaques, cada um um link para o artigo', () => {
    setup({ linkQuery: '?lat=-18.9&lon=-48.2' })
    const start = screen.getByRole('region', { name: 'Comece por aqui' })
    expect(within(start).getByRole('link', { name: /Como ler o raio-X da sua terra/ })).toHaveAttribute(
      'href',
      '/guia/raio-x?lat=-18.9&lon=-48.2',
    )
  })

  it('cada tema com o ícone, o nome e "{n} artigos"; cada cartão é um link com resumo e tempo de leitura', () => {
    setup({ featured: [] })
    const climate = screen.getByRole('region', { name: 'Clima, água e dados' })

    expect(within(climate).getByText('2 artigos')).toBeInTheDocument()
    const card = within(climate).getByRole('link', { name: 'Veranico' })
    expect(card).toHaveAttribute('href', '/guia/veranico')
    expect(within(climate).getByText('Resumo de Veranico.')).toBeInTheDocument()
    expect(within(climate).getByText('1 min de leitura')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Culturas' })).getByText('1 artigo')).toBeInTheDocument()
  })

  it('nada na tela fala de revisão, nem no artigo marcado como rascunho (regra de 15/11)', () => {
    setup()
    expect(screen.queryByText(/revisão|rascunho|agrônoma/i)).not.toBeInTheDocument()
  })

  it('o cartão de cultura tem a foto da tela 5, com o crédito', () => {
    setup()
    const cultures = screen.getByRole('region', { name: 'Culturas' })

    expect(within(cultures).getByRole('img')).toHaveAttribute('src', '/fotos/sorgo.jpg')
    expect(within(cultures).getByText(/Foto:/)).toBeInTheDocument()
    expect(within(cultures).getByRole('link', { name: 'Sorgo' })).toHaveAttribute('href', '/guia/sorgo')
  })

  it('a busca esconde os temas e mostra quantos achou, o tema de cada cartão e a palavra marcada', () => {
    setup({
      searching: true,
      filters: { theme: 'all', query: 'erosao' },
      featured: [],
      groups: [],
      results: [
        {
          article: erosao,
          title: [
            { text: 'Como evitar ', mark: false },
            { text: 'erosão', mark: true },
          ],
          summary: [{ text: 'Resumo.', mark: false }],
        },
      ],
    })

    expect(screen.queryByRole('group', { name: 'Temas' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('1 resultado para "erosao"')
    expect(screen.getByRole('link', { name: 'Como evitar erosão' })).toHaveAttribute('href', '/guia/como-evitar-erosao')
    expect(screen.getByText('erosão', { selector: 'mark' })).toBeInTheDocument()
    expect(screen.getByText('Cuidar da terra')).toBeInTheDocument()
  })

  it('sem resultado, diz que não achou e oferece 3 sugestões clicáveis', async () => {
    const props = setup({ searching: true, filters: { theme: 'all', query: 'zzz' }, featured: [], groups: [], results: [] })

    expect(screen.getByText('Nenhum artigo encontrado para "zzz"')).toBeInTheDocument()
    expect(screen.getByText('Tente outra palavra ou veja um destes:')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^(veranico|palhada|sorgo)$/ })).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: 'veranico' }))
    expect(props.onQuery).toHaveBeenCalledWith('veranico')
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en', searching: true, filters: { theme: 'all', query: 'zzz' }, featured: [], groups: [], results: [] })

    expect(screen.getByRole('heading', { level: 1, name: 'Guide' })).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search the Guide' })).toHaveAttribute('placeholder', 'Search: dry spell, straw…')
    expect(screen.getByText('No article found for "zzz"')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'dry spell' })).toBeInTheDocument()
    expect(screen.queryByText(/review|agronomist/i)).not.toBeInTheDocument()
  })
})
