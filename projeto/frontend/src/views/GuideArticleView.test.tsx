import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { GuideArticle, GuideSummary } from '../models/guide'
import { articleLayout } from '../services/guideService'
import { parseMarkdown } from '../services/markdownService'
import { GuideArticleView, type GuideArticleViewProps } from './GuideArticleView'

const body = parseMarkdown(
  [
    '## Em uma frase',
    '',
    'Erosão é a chuva levando embora a camada boa da terra.',
    '',
    '## Por que importa',
    '',
    'Três cuidados trabalham juntos:',
    '',
    '- **Cobertura:** a palhada protege a terra.',
    '- **Plantio direto:** plantar sem arar.',
    '- **Curvas de nível e terraços:** seguram a água.',
    '',
    'Veja [a palhada](/guia/palhada) e [a Embrapa](https://www.embrapa.br).',
    '',
    '<script>x</script>',
    '',
    '## Na sua lavoura',
    '',
    'Veja na [Sugestão](/resposta).',
    '',
    '## Fontes',
    '',
    '- Números do app: parâmetros do Raiz Orbital.',
    '- [Embrapa: terraços](https://www.embrapa.br/terracos)',
  ].join('\n'),
)
const article: GuideArticle = {
  slug: 'como-evitar-erosao',
  title: 'Como evitar erosão',
  summary: 'A chuva leva a camada boa da terra.',
  theme: 'soil',
  draft: true,
  plant: null,
  minutes: 2,
  related: ['palhada'],
  blocks: body,
}
const palhada: GuideSummary = { ...article, slug: 'palhada', title: 'Palhada: por que cobrir a terra', related: [] }
const field = {
  place: 'Sua lavoura, perto de Uberlândia (MG)',
  text: 'Em 20 anos, houve 5 dias de chuva forte em fevereiro e março: em média, 0,25 dia por ano.',
  source: 'Fonte: GPM IMERG (NASA), 20 anos',
}

function setup(overrides: Partial<GuideArticleViewProps> = {}) {
  const a = overrides.article === undefined ? article : overrides.article
  const props: GuideArticleViewProps = {
    t: pt,
    lang: 'pt',
    article: a,
    layout: a ? articleLayout(a.blocks) : null,
    related: [palhada],
    field: null,
    helpful: null,
    onHelpful: vi.fn(),
    onJump: vi.fn(),
    backTo: '/guia',
    linkQuery: '',
    listen: { supported: true, speaking: false, toggle: vi.fn() },
    ...overrides,
  }
  render(
    <MemoryRouter>
      <GuideArticleView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('GuideArticleView (artigo, tela 8)', () => {
  it('o "← Voltar ao Guia", o tema, o título, o tempo de leitura e o "Ouvir resumo"', async () => {
    const props = setup({ backTo: '/guia?lat=-18.9&lon=-48.2' })

    expect(screen.getByRole('link', { name: 'Voltar ao Guia' })).toHaveAttribute('href', '/guia?lat=-18.9&lon=-48.2')
    expect(screen.getByRole('link', { name: 'Voltar ao Guia' })).toHaveAttribute('data-back-button')
    expect(screen.getByText('Cuidar da terra')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Como evitar erosão' })).toBeInTheDocument()
    expect(screen.getByText('2 min de leitura')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ouvir resumo' }))
    expect(props.listen.toggle).toHaveBeenCalled()
  })

  it('nenhum artigo mostra faixa de revisão, nem o marcado como rascunho (regra de 15/11)', () => {
    setup({ article: { ...article, draft: true } })
    expect(screen.queryByText(/revisão|rascunho|agrônoma do time/i)).not.toBeInTheDocument()
  })

  it('"Em uma frase" em destaque, fora das seções', () => {
    setup()
    const sentence = screen.getByRole('region', { name: 'Em uma frase' })
    expect(sentence).toHaveTextContent('Erosão é a chuva levando embora a camada boa da terra.')
    expect(screen.queryByRole('heading', { name: 'Em uma frase' })).not.toBeInTheDocument()
  })

  it('as seções com âncora e a lista de cuidados em cartões', () => {
    setup()
    expect(screen.getByRole('heading', { level: 2, name: 'Por que importa' })).toHaveAttribute('id', 'por-que-importa')
    expect(screen.getByRole('heading', { level: 2, name: 'Na sua lavoura' })).toHaveAttribute('id', 'na-sua-lavoura')
    const cards = screen.getByRole('list', { name: 'Três cuidados trabalham juntos:' })
    expect(within(cards).getAllByRole('listitem')).toHaveLength(3)
    expect(within(cards).getByText('Cobertura')).toBeInTheDocument()
    expect(within(cards).getByText('A palhada protege a terra.')).toBeInTheDocument()
  })

  it('links internos ficam no app com o fluxo, externos abrem em nova aba, e HTML do texto vira texto', () => {
    setup({ linkQuery: '?lat=-18.9&lon=-48.2' })
    expect(screen.getByRole('link', { name: 'a palhada' })).toHaveAttribute('href', '/guia/palhada?lat=-18.9&lon=-48.2')
    expect(screen.getByRole('link', { name: 'Sugestão' })).toHaveAttribute('href', '/resposta?lat=-18.9&lon=-48.2')
    const external = screen.getByRole('link', { name: 'a Embrapa' })
    expect(external).toHaveAttribute('target', '_blank')
    expect(external).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByText('<script>x</script>')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })

  it('"Na sua lavoura" mostra a caixa com o lugar, o número e a fonte quando há dado do ponto', () => {
    setup({ field })
    const box = screen.getByRole('note')
    expect(box).toHaveTextContent('Sua lavoura, perto de Uberlândia (MG)')
    expect(box).toHaveTextContent(field.text)
    expect(box).toHaveTextContent('Fonte: GPM IMERG (NASA), 20 anos')
  })

  it('sem dado do ponto, a caixa não aparece', () => {
    setup({ field: null })
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    expect(screen.queryByText(/Sua lavoura, perto de/)).not.toBeInTheDocument()
  })

  it('"Fontes conferidas" recolhidas num <details>, com os links em nova aba', () => {
    setup()
    const details = screen.getByText('Fontes conferidas').closest('details')!
    expect(details).not.toHaveAttribute('open')
    expect(within(details).getByText('Números do app: parâmetros do Raiz Orbital.')).toBeInTheDocument()
    expect(within(details).getByRole('link', { name: 'Embrapa: terraços', hidden: true })).toHaveAttribute('target', '_blank')
    expect(screen.queryByRole('heading', { name: 'Fontes' })).not.toBeInTheDocument()
  })

  it('"Este artigo ajudou? Sim / Não": marca e, depois de marcar, agradece', async () => {
    const props = setup()
    const yes = screen.getByRole('button', { name: 'Sim' })
    expect(yes).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText('Obrigado!')).not.toBeInTheDocument()
    await userEvent.click(yes)
    expect(props.onHelpful).toHaveBeenCalledWith('yes')
  })

  it('com a resposta marcada, o botão fica pressionado e aparece o "Obrigado!"', () => {
    setup({ helpful: 'no' })
    expect(screen.getByRole('button', { name: 'Não' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Obrigado!')).toBeInTheDocument()
  })

  it('"Neste artigo" leva às seções e "Veja também" aos relacionados', async () => {
    const props = setup({ linkQuery: '?lat=-18.9&lon=-48.2' })
    const toc = screen.getByRole('navigation', { name: 'Neste artigo' })
    const link = within(toc).getByRole('link', { name: 'Na sua lavoura' })
    expect(link).toHaveAttribute('href', '#na-sua-lavoura')
    await userEvent.click(link)
    expect(props.onJump).toHaveBeenCalledWith('na-sua-lavoura')

    const seeAlso = screen.getByRole('region', { name: 'Veja também' })
    expect(within(seeAlso).getByRole('link', { name: /Palhada: por que cobrir a terra/ })).toHaveAttribute(
      'href',
      '/guia/palhada?lat=-18.9&lon=-48.2',
    )
  })

  it('artigo de cultura mostra a foto real com o crédito, no lugar do desenho (15/11/2026)', () => {
    setup({ article: { ...article, plant: 'sorgo', theme: 'cultures' } })
    expect(screen.getByRole('img', { name: /Lavoura de sorgo com os cachos de grão maduros/ })).toHaveAttribute('src', '/fotos/sorgo.jpg')
    expect(screen.getByRole('link', { name: /Josue Marinho/ })).toHaveAttribute('href', expect.stringContaining('commons.wikimedia.org'))
    expect(screen.queryByRole('img', { name: 'Desenho de sorgo' })).not.toBeInTheDocument()
  })

  it('em inglês, a foto vem com o texto alternativo e o crédito em inglês', () => {
    setup({ t: en, lang: 'en', article: { ...article, plant: 'sorgo', theme: 'cultures' } })
    expect(screen.getByRole('img', { name: /Sorghum field with ripe grain heads/ })).toBeInTheDocument()
    expect(screen.getByText(/Photo:/)).toBeInTheDocument()
  })

  it('em inglês', () => {
    setup({ t: en })
    expect(screen.getByRole('link', { name: 'Back to the Guide' })).toBeInTheDocument()
    expect(screen.queryByText(/under review|draft/i)).not.toBeInTheDocument()
    expect(screen.getByText('Checked sources')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'In this article' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument()
  })

  it('artigo inexistente mostra a mensagem e o caminho de volta', () => {
    setup({ article: null })
    expect(screen.getByText('Não achamos esse artigo.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar ao Guia' })).toHaveAttribute('href', '/guia')
  })
})
