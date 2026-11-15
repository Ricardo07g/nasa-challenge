import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { GuideArticle } from '../models/guide'
import { parseMarkdown } from '../services/markdownService'
import { GuideArticleView, GuideView, type GuideViewProps } from './GuideView'

const groups: GuideViewProps['groups'] = [
  {
    theme: 'cultures',
    articles: [{ slug: 'sorgo', title: 'Sorgo', theme: 'cultures', draft: true, plant: 'sorgo' }],
  },
  {
    theme: 'climate',
    articles: [{ slug: 'veranico', title: 'Veranico', theme: 'climate', draft: false, plant: null }],
  },
]

function setupIndex(overrides: Partial<GuideViewProps> = {}) {
  const props: GuideViewProps = {
    t: pt,
    groups,
    query: '',
    onQuery: vi.fn(),
    count: 2,
    backTo: '/comunidade',
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

describe('GuideView (página inicial)', () => {
  it('pacote 2: o "← Voltar" de verdade e o "Ouvir resumo" perto do título', async () => {
    const props = setupIndex()

    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('data-back-button')
    await userEvent.click(screen.getByRole('button', { name: 'Ouvir resumo' }))
    expect(props.listen.toggle).toHaveBeenCalled()
  })

  it('mostra os temas e os artigos com link, e marca o rascunho com texto', () => {
    setupIndex()
    expect(screen.getByRole('heading', { level: 1, name: 'Guia' })).toBeInTheDocument()
    const cultures = screen.getByRole('region', { name: 'Culturas' })
    expect(within(cultures).getByRole('link', { name: /Sorgo/ })).toHaveAttribute('href', '/guia/sorgo')
    expect(within(cultures).getByText('Rascunho')).toBeInTheDocument()
    const climate = screen.getByRole('region', { name: 'Clima, água e dados' })
    expect(within(climate).queryByText('Rascunho')).toBeNull()
  })

  it('diz a área do MVP logo abaixo do título, sem mexer nos artigos (tarefa 0051)', () => {
    setupIndex()
    expect(
      screen.getByText(
        'Nesta primeira versão (MVP), o app funciona na região de Uberlândia e Uberaba (MG). Vamos ampliar para todo o Triângulo Mineiro.',
      ),
    ).toBeInTheDocument()
  })

  it('a área do MVP em inglês', () => {
    setupIndex({ t: en })
    expect(
      screen.getByText(
        'This first version (MVP) works in the Uberlândia and Uberaba region (Minas Gerais, Brazil). We will expand to the whole Triângulo Mineiro.',
      ),
    ).toBeInTheDocument()
  })

  it('a busca avisa o controller', async () => {
    const props = setupIndex()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar pelo título' }), 'v')
    expect(props.onQuery).toHaveBeenCalledWith('v')
  })

  it('sem resultado, diz que não achou', () => {
    setupIndex({ groups: [], count: 0, query: 'zzz' })
    expect(screen.getByText('Nenhum artigo com esse título.')).toBeInTheDocument()
  })
})

const body = parseMarkdown(
  '## Em uma frase\n\nO sorgo aguenta seca. Veja [a rotação](/guia/rotacao) e [a Embrapa](https://www.embrapa.br).\n\n<script>x</script>',
)
const article: GuideArticle = { slug: 'sorgo', title: 'Sorgo', theme: 'cultures', draft: true, plant: 'sorgo', blocks: body }

describe('GuideArticleView', () => {
  const listen = { supported: true, speaking: false, toggle: vi.fn() }

  function setup(a: GuideArticle | null, t = pt) {
    render(
      <MemoryRouter>
        <GuideArticleView t={t} article={a} listen={listen} />
      </MemoryRouter>,
    )
  }

  it('pacote 2: o "← Voltar ao Guia" de verdade e o "Ouvir resumo" do artigo', async () => {
    setup(article)

    expect(screen.getByRole('link', { name: 'Voltar ao Guia' })).toHaveAttribute('data-back-button')
    await userEvent.click(screen.getByRole('button', { name: 'Ouvir resumo' }))
    expect(listen.toggle).toHaveBeenCalled()
  })

  it('título, aviso de rascunho no topo, desenho da planta e texto', () => {
    setup(article)
    expect(screen.getByRole('heading', { level: 1, name: 'Sorgo' })).toBeInTheDocument()
    expect(screen.getByText('Rascunho: a revisar pela agrônoma.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Desenho de sorgo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Em uma frase' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao Guia' })).toHaveAttribute('href', '/guia')
  })

  it('links internos ficam no app e externos abrem em outra aba, sem HTML do texto', () => {
    setup(article)
    expect(screen.getByRole('link', { name: 'a rotação' })).toHaveAttribute('href', '/guia/rotacao')
    const external = screen.getByRole('link', { name: 'a Embrapa' })
    expect(external).toHaveAttribute('target', '_blank')
    expect(external).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByText('<script>x</script>')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })

  it('sem rascunho, sem aviso; em inglês, o aviso em inglês', () => {
    setup({ ...article, draft: false, plant: null })
    expect(screen.queryByText(/Rascunho/)).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('aviso em inglês', () => {
    setup(article, en)
    expect(screen.getByText('Draft: to be reviewed by the agronomist.')).toBeInTheDocument()
  })

  it('artigo inexistente mostra a mensagem e o caminho de volta', () => {
    setup(null)
    expect(screen.getByText('Não achamos esse artigo.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao Guia' })).toHaveAttribute('href', '/guia')
  })
})
