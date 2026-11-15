import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from './i18n/I18nProvider'
import { routes } from './routes'

// O mapa real (Leaflet) é testado no design system; aqui, um toque num ponto fixo da área do MVP.
vi.mock('./design-system/components/FieldMap', () => ({
  FieldMap: ({ label, onPick }: { label: string; onPick: (point: { lat: number; lon: number }) => void }) => (
    <section aria-label={label}>
      <button type="button" onClick={() => onPick({ lat: -19.0, lon: -48.2 })}>
        tocar no mapa
      </button>
    </section>
  ),
}))

function renderAt(path: string, lang: 'pt' | 'en' = 'pt') {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <I18nProvider initialLang={lang}>
      <RouterProvider router={router} />
    </I18nProvider>,
  )
  return router
}

describe('rotas', () => {
  it('abre o início com o cabeçalho comum', async () => {
    renderAt('/')

    expect(await screen.findByRole('heading', { level: 1, name: 'O que plantar depois da soja?' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Raiz Orbital, voltar ao início' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('a tela 5 tem as abas "Escolher" e "Plano de 3 anos"; /plano abre a aba do plano e o Voltar vai ao raio-X', async () => {
    renderAt('/plano?lat=-18.9543&lon=-48.1993&colheita=meio')

    const tabs = await screen.findByRole('tablist', { name: 'Etapas' })
    expect(tabs).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Plano de 3 anos' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/satelite?lat=-18.9543&lon=-48.1993&colheita=meio')
    expect(document.title).toBe('Raiz Orbital – Plano de 3 anos')
  })

  it('/opcoes abre a aba "Escolher" da tela 5', async () => {
    renderAt('/opcoes?lat=-18.9543&lon=-48.1993&colheita=meio')

    expect(await screen.findByRole('tab', { name: 'Escolher' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('group', { name: 'Comparar:' })).toBeInTheDocument()
  })

  it('as outras telas não têm as abas da resposta', async () => {
    renderAt('/onde')

    await screen.findByRole('heading', { level: 1, name: 'Onde fica a lavoura?' })
    expect(screen.queryByRole('tablist', { name: 'Etapas' })).not.toBeInTheDocument()
  })

  it('a pergunta da colheita abre com o ponto da URL, o título da aba e sem data (tarefa 0057)', async () => {
    renderAt('/quando?lat=-18.9543&lon=-48.1993')

    expect(await screen.findByRole('heading', { level: 1, name: 'Quando você colhe a soja?' })).toBeInTheDocument()
    // O satélite não vê o dia da colheita: o dia dos dados de exemplo (15/fev) não preenche mais a tela.
    expect(await screen.findByRole('heading', { name: 'Escolha o dia da colheita' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próximo passo Ver a resposta' })).toBeDisabled()
    expect(document.title).toBe('Raiz Orbital – Quando você colhe a soja?')
  })

  it('na pergunta da colheita, escolher a época não mexe na rolagem e vai para a URL (regra geral 2)', async () => {
    let scrollY = 0
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY)
    vi.spyOn(window, 'scrollTo').mockImplementation(((x: number | ScrollToOptions, y?: number) => {
      scrollY = typeof x === 'number' ? (y ?? 0) : (x.top ?? 0)
    }) as typeof window.scrollTo)
    const router = renderAt('/quando?lat=-18.9543&lon=-48.1993')
    await screen.findByRole('heading', { name: 'Escolha o dia da colheita' })
    window.scrollTo(0, 420)

    await userEvent.click(screen.getByRole('button', { name: 'Não sei o dia exato' }))
    const dialog = await screen.findByRole('dialog', { name: 'Quando costuma ser a sua colheita?' })
    await userEvent.click(within(dialog).getByRole('radio', { name: /Meio de fevereiro/ }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Usar esta época' }))

    await vi.waitFor(() => expect(router.state.location.search).toBe('?lat=-18.9543&lon=-48.1993&colheita=meio'))
    expect(router.state.historyAction).toBe('REPLACE')
    expect(window.scrollY).toBe(420)
    expect(screen.getByRole('heading', { name: 'Meio de fevereiro' })).toBeInTheDocument()
  })

  it('a pergunta 2 sem ponto marcado volta para o mapa', async () => {
    renderAt('/quando')

    expect(await screen.findByRole('heading', { level: 1, name: 'Onde fica a lavoura?' })).toBeInTheDocument()
  })

  it('na pergunta 1, tocar no mapa e "Confirmar local" leva à pergunta 2 com o ponto na URL (tarefa 0053)', async () => {
    const router = renderAt('/onde')

    await userEvent.click(await screen.findByRole('button', { name: 'tocar no mapa' }))
    const confirm = screen.getByRole('button', { name: 'Confirmar local' })
    await vi.waitFor(() => expect(confirm).toBeEnabled())
    await userEvent.click(confirm)

    await vi.waitFor(() =>
      expect(`${router.state.location.pathname}${router.state.location.search}`).toBe('/quando?lat=-19&lon=-48.2'),
    )
  })

  it('na pergunta 1, "Usar a lavoura de demonstração" e "Confirmar local" seguem com o exemplo=1', async () => {
    const router = renderAt('/onde')

    await userEvent.click(await screen.findByRole('button', { name: /Usar a lavoura de demonstração/ }))
    expect(screen.getByRole('heading', { name: 'Lavoura de demonstração, perto de Uberlândia (MG)' })).toBeInTheDocument()
    const confirm = screen.getByRole('button', { name: 'Confirmar local' })
    await vi.waitFor(() => expect(confirm).toBeEnabled())
    await userEvent.click(confirm)

    await vi.waitFor(() =>
      expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
        '/quando?lat=-18.9543&lon=-48.1993&exemplo=1',
      ),
    )
  })

  it('"Próximo passo" na pergunta da colheita abre a missão do satélite (RF-19)', async () => {
    renderAt('/quando?lat=-18.9543&lon=-48.1993&data=2027-02-15&colheita=meio')

    await userEvent.click(await screen.findByRole('button', { name: 'Próximo passo Ver a resposta' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Missão: sua lavoura' })).toBeInTheDocument()
    expect(await screen.findByRole('progressbar', { name: 'Missão: sua lavoura' })).toBeInTheDocument()
    expect(document.title).toBe('Raiz Orbital – Missão: sua lavoura')
  })

  it('a tela 4 abre direto pela URL com o que o satélite viu', async () => {
    renderAt('/satelite?lat=-18.9543&lon=-48.1993&colheita=meio')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pronto. O satélite já viu o resto.' }),
    ).toBeInTheDocument()
    // A tela espera o raio-X: abre já com o painel, sem o cartão da terra de antes passar na frente.
    expect(await screen.findByRole('region', { name: 'Perto de Uberlândia (MG)' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Suas últimas safras' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Terra média' })).not.toBeInTheDocument()
  })

  it('/planejamento abre a tela final "Seu planejamento", com o "Voltar ao plano" para o Plano de 3 anos (pacote 3)', async () => {
    renderAt('/planejamento?lat=-18.9543&lon=-48.1993&colheita=meio&safras=2025:pousio')

    expect(await screen.findByRole('heading', { level: 1, name: 'Seu planejamento' })).toBeInTheDocument()
    expect(await screen.findByRole('region', { name: 'O que fazer agora' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Alertas da sua área' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Clima de 2041 a 2060' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Imprimir relatório' })).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Voltar ao plano' })).toHaveAttribute(
      'href',
      '/plano?lat=-18.9543&lon=-48.1993&colheita=meio&safras=2025:pousio',
    )
    expect(document.title).toBe('Raiz Orbital – Seu planejamento')
  })

  it('a missão sem a colheita volta para a pergunta 2', async () => {
    renderAt('/calculando?lat=-18.9543&lon=-48.1993')

    expect(await screen.findByRole('heading', { level: 1, name: 'Quando você colhe a soja?' })).toBeInTheDocument()
  })

  it('a tela 4 sem a colheita volta para a pergunta 2', async () => {
    renderAt('/satelite?lat=-18.9543&lon=-48.1993')

    expect(await screen.findByRole('heading', { level: 1, name: 'Quando você colhe a soja?' })).toBeInTheDocument()
  })

  it('"Ver o que plantar" na tela 4 abre a tela 5 com a sugestão', async () => {
    renderAt('/satelite?lat=-18.9543&lon=-48.1993&colheita=meio')

    await userEvent.click(await screen.findByRole('button', { name: 'Ver o que plantar' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'O que plantar depois da soja' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 2, name: 'Milho com braquiária' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Escolher' })).toHaveAttribute('aria-selected', 'true')
    expect(document.title).toBe('Raiz Orbital – O que plantar depois da soja')
  })

  it('a resposta sem a colheita volta para a pergunta 2', async () => {
    renderAt('/resposta?lat=-18.9543&lon=-48.1993')

    expect(await screen.findByRole('heading', { level: 1, name: 'Quando você colhe a soja?' })).toBeInTheDocument()
  })

  it('na tela 5, o objetivo da URL vem marcado e a aba "Plano de 3 anos" abre o plano em cadeia', async () => {
    renderAt('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio&objetivo=terra')

    expect(await screen.findByRole('button', { name: 'Cuidar da terra' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Plano de 3 anos' }))

    const years = await screen.findByRole('list', { name: 'Seu plano ano a ano' })
    expect(years).toHaveTextContent('Depois da soja 2026/27')
    expect(await screen.findByRole('table', { name: 'Notas do seu plano ao lado de como é hoje' })).toBeInTheDocument()
  })

  it('"Guia" no cabeçalho abre o Guia, e a pílula fica marcada lá (pacote 3)', async () => {
    renderAt('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')

    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: 'Guia' })).not.toHaveAttribute('aria-current')
    await userEvent.click(within(banner).getByRole('link', { name: 'Guia' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Guia' })).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Guia' })).toHaveAttribute('aria-current', 'page')
  })

  it('/comunidade mostra só o "Em breve" com o "Abrir o Guia", sem relatos de vizinhos (pacote 3)', async () => {
    renderAt('/comunidade')

    const card = await screen.findByRole('region', { name: 'Comunidade da sua região' })
    expect(within(card).getByText('Em breve')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Perto de você' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Conte o que aconteceu aí' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Relato de vizinho/)).not.toBeInTheDocument()
    expect(document.title).toBe('Raiz Orbital – Comunidade da sua região')

    await userEvent.click(within(card).getByRole('link', { name: 'Abrir o Guia' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Guia' })).toBeInTheDocument()
  })

  it('o link antigo da Comunidade com o caminho da lavoura continua abrindo, e o Voltar vai para a resposta', async () => {
    renderAt('/comunidade?lat=-18.9543&lon=-48.1993&colheita=meio')

    expect(await screen.findByRole('heading', { level: 1, name: 'Comunidade da sua região' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute(
      'href',
      '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
  })

  it('em /avisos, o sino do cabeçalho fica marcado (pacote 3)', async () => {
    renderAt('/avisos')

    const banner = screen.getByRole('banner')
    expect(within(banner).getByRole('link', { name: /^Avisos/ })).toHaveAttribute('aria-current', 'page')
    expect(within(banner).getByRole('link', { name: 'Guia' })).not.toHaveAttribute('aria-current')
  })

  it('"Como a conta é feita" no rodapé das telas internas abre a tela 9 com as notas da lavoura', async () => {
    renderAt('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')

    const footer = await screen.findByRole('contentinfo')
    await userEvent.click(within(footer).getByRole('link', { name: 'Como a conta é feita' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Como a conta é feita' })).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: 'Notas de cada opção (0 a 100)' })).toBeInTheDocument()
    expect(document.title).toBe('Raiz Orbital – Como a conta é feita')
  })

  it('o relatório saiu (tarefa 0044): o endereço antigo leva à Sugestão com o mesmo caminho', async () => {
    const router = renderAt('/relatorio?lat=-18.9543&lon=-48.1993&colheita=meio')

    await vi.waitFor(() =>
      expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
        '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio',
      ),
    )
    expect(screen.queryByText(/Relatório/)).not.toBeInTheDocument()
  })

  it('a safra passada virou o detalhe do ano: o endereço antigo abre a tela 5 com o ano no "Por que essa sugestão?"', async () => {
    const router = renderAt('/safra-passada?lat=-18.9543&lon=-48.1993&colheita=meio&ano=2024')

    await vi.waitFor(() =>
      expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
        '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio&ano=2024',
      ),
    )
    expect(await screen.findByRole('region', { name: 'O que aconteceu em 2024' })).toBeInTheDocument()
  })

  it('as telas internas têm o rodapé com o aviso, "Como a conta é feita", os créditos e o projeto', async () => {
    renderAt('/onde')

    const footer = await screen.findByRole('contentinfo')
    expect(footer).toHaveTextContent('Ajuda a decidir. Não substitui o seu agrônomo.')
    expect(footer).toHaveTextContent('NASA Space Apps 2026 · Field Shift')
    expect(within(footer).getByRole('link', { name: 'Como a conta é feita' })).toHaveAttribute('href', '/como-funciona')
    expect(within(footer).getByRole('button', { name: 'Créditos e uso de IA' })).toBeInTheDocument()
    // A faixa grande do agrônomo só existe na Início.
    expect(screen.queryByRole('region', { name: 'É agrônomo(a) ou técnico(a)?' })).not.toBeInTheDocument()
  })

  it('na Início, o rodapé fica sem o link do agrônomo: a faixa grande, logo acima, leva para a mesma tela', async () => {
    renderAt('/')

    const footer = await screen.findByRole('contentinfo')
    expect(within(footer).queryByRole('link')).not.toBeInTheDocument()
    expect(within(footer).getByRole('button', { name: 'Créditos e uso de IA' })).toBeInTheDocument()
    const agro = screen.getByRole('region', { name: 'É agrônomo(a) ou técnico(a)?' })
    expect(within(agro).getByRole('link', { name: 'Como a conta é feita' })).toHaveAttribute('href', '/como-funciona')
  })

  it('o cabeçalho de toda tela tem só Guia, Avisos e o idioma, sem Comunidade e sem o botão grande "Ouvir"', async () => {
    for (const path of ['/', '/onde', '/guia', '/avisos', '/comunidade', '/satelite?lat=-18.9543&lon=-48.1993&colheita=tarde&exemplo=1']) {
      renderAt(path)
      const banner = await screen.findByRole('banner')
      const nav = within(banner).getByRole('navigation', { name: 'Principal' })
      const [guide, alerts, ...others] = within(nav).getAllByRole('link')
      expect(guide).toHaveTextContent('Guia')
      expect(alerts).toHaveTextContent(/^Avisos\d*$/)
      expect(others).toEqual([])
      expect(within(banner).queryByText(/Comunidade/)).not.toBeInTheDocument()
      expect(within(banner).queryByRole('button', { name: /Ouvir/ })).not.toBeInTheDocument()
      cleanup()
    }
  })

  it('"Créditos e uso de IA" abre o mesmo modal global em qualquer tela, e Esc fecha e devolve o foco', async () => {
    renderAt('/comunidade')

    const button = within(await screen.findByRole('contentinfo')).getByRole('button', { name: 'Créditos e uso de IA' })
    await userEvent.click(button)
    expect(screen.getByRole('dialog', { name: 'Créditos e uso de IA' })).toHaveTextContent('GPM IMERG Final')

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(button).toHaveFocus()
  })

  it('na Início, o selo da NASA abre "De onde vêm os dados", e "Todas as fontes e créditos" troca pelo de créditos', async () => {
    renderAt('/')

    const seal = await screen.findByRole('button', { name: 'Dados da NASA Triângulo Mineiro · MG' })
    await userEvent.click(seal)
    const sources = screen.getByRole('dialog', { name: 'De onde vêm os dados' })
    await userEvent.click(within(sources).getByRole('button', { name: 'Todas as fontes e créditos' }))

    expect(screen.queryByRole('dialog', { name: 'De onde vêm os dados' })).not.toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Créditos e uso de IA' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(seal).toHaveFocus()
  })

  it('o início fica igual ao protótipo: sem aviso de dados de exemplo e com o título da aba dele', async () => {
    renderAt('/')

    await screen.findByRole('heading', { level: 1, name: 'O que plantar depois da soja?' })
    expect(screen.queryByText(/Dados de exemplo/)).not.toBeInTheDocument()
    expect(document.title).toBe('Raiz Orbital – Início')
  })

  it('nos testes os dados são de exemplo: toda tela mostra o aviso fixo de demonstração', async () => {
    renderAt('/onde')

    await screen.findByRole('heading', { level: 1, name: 'Onde fica a lavoura?' })
    expect(screen.getByRole('note')).toHaveTextContent('Modo de demonstração: dados de exemplo, não são da NASA')
  })

  it('o título da aba acompanha o idioma', async () => {
    renderAt('/', 'en')

    await screen.findByRole('heading', { level: 1, name: 'What to plant after soybeans?' })
    expect(document.title).toBe('Raiz Orbital – Home')
  })

  it('"Começar" leva para a pergunta 1', async () => {
    renderAt('/')

    await userEvent.click(await screen.findByRole('link', { name: 'Começar' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Onde fica a lavoura?' })).toBeInTheDocument()
  })

  it('PT | EN troca a tela inteira de idioma', async () => {
    renderAt('/')

    await userEvent.click(await screen.findByRole('button', { name: 'Trocar idioma: português ou inglês' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'What to plant after soybeans?' })).toBeInTheDocument()
  })

  it('o exemplo pronto (/exemplo) vai para a resposta da fazenda de exemplo', async () => {
    const router = renderAt('/exemplo')

    await vi.waitFor(() =>
      expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
        '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio&exemplo=1',
      ),
    )
  })

  it('/guia mostra os temas e /guia/:artigo abre um artigo real, em pt e en', async () => {
    renderAt('/guia')
    expect(await screen.findByRole('heading', { level: 1, name: 'Guia' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Culturas' })).toBeInTheDocument()
    cleanup()

    renderAt('/guia/veranico')
    expect(await screen.findByRole('heading', { level: 1, name: 'Veranico' })).toBeInTheDocument()
    cleanup()

    renderAt('/guia/veranico', 'en')
    expect(await screen.findByRole('heading', { level: 1, name: 'Dry spell' })).toBeInTheDocument()
    cleanup()

    renderAt('/guia/nao-existe')
    expect(await screen.findByText('Não achamos esse artigo.')).toBeInTheDocument()
  })

  it('endereço desconhecido volta ao início', async () => {
    renderAt('/nao-existe')

    expect(await screen.findByRole('heading', { level: 1, name: 'O que plantar depois da soja?' })).toBeInTheDocument()
  })

  // Tela "Avisos" (seção 6 da remodelagem, tarefa 0046)
  it('/avisos sem ponto pede para marcar a lavoura, com os alertas oficiais e o botão no cabeçalho', async () => {
    window.localStorage.clear()
    renderAt('/avisos')

    expect(await screen.findByRole('heading', { level: 1, name: 'Avisos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Marcar minha lavoura' })).toHaveAttribute('href', '/onde')
    expect(screen.getByRole('region', { name: 'Alertas oficiais' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Avisos' })).toHaveAttribute('href', '/avisos')
    expect(document.title).toBe('Raiz Orbital – Avisos')
  })

  it('/guia/como-ler-os-avisos abre o artigo dos avisos, em pt e en', async () => {
    renderAt('/guia/como-ler-os-avisos')
    expect(await screen.findByRole('heading', { level: 1, name: 'Como ler os avisos' })).toBeInTheDocument()
    cleanup()

    renderAt('/guia/como-ler-os-avisos', 'en')
    expect(await screen.findByRole('heading', { level: 1, name: 'How to read the alerts' })).toBeInTheDocument()
  })

  it('/avisos com o ponto da lavoura mostra os grupos e o número no botão do cabeçalho', async () => {
    window.localStorage.clear()
    renderAt('/avisos?lat=-18.9543&lon=-48.1993&colheita=meio')

    expect(await screen.findByRole('region', { name: 'Agora' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Perto de você' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Avisos: 2 avisos ativos' })).toBeInTheDocument()
  })
})
