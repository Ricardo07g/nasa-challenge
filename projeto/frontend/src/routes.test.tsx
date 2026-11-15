import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from './i18n/I18nProvider'
import { routes } from './routes'

vi.mock('./design-system/components/MapPicker', () => ({
  MapPicker: ({ label }: { label: string }) => <section aria-label={label} />,
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

  it('as telas da resposta têm as abas, com a atual marcada e o ponto mantido na URL', async () => {
    renderAt('/plano?lat=-18.9543&lon=-48.1993&colheita=meio')

    const nav = await screen.findByRole('navigation', { name: 'Telas da resposta' })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Plano de 3 anos' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Sugestão' })).toHaveAttribute(
      'href',
      '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute(
      'href',
      '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
  })

  it('as outras telas não têm as abas da resposta', async () => {
    renderAt('/onde')

    await screen.findByRole('heading', { level: 1, name: 'Onde fica a lavoura?' })
    expect(screen.queryByRole('navigation', { name: 'Telas da resposta' })).not.toBeInTheDocument()
  })

  it('a pergunta 2 (colheita) abre com o ponto da URL e o título da aba', async () => {
    renderAt('/quando?lat=-18.9543&lon=-48.1993')

    expect(await screen.findByRole('heading', { level: 1, name: 'Quando você colhe a soja?' })).toBeInTheDocument()
    // Tarefa 0042: o dia do satélite (dados de exemplo: 15/fev) já vem no campo, com a faixa dele.
    expect(await screen.findByText('Dia 15 de fevereiro: conta como meio de fevereiro.')).toBeInTheDocument()
    expect(document.title).toBe('Raiz Orbital – Quando você colhe a soja?')
  })

  it('a pergunta 2 sem ponto marcado volta para o mapa', async () => {
    renderAt('/quando')

    expect(await screen.findByRole('heading', { level: 1, name: 'Onde fica a lavoura?' })).toBeInTheDocument()
  })

  it('na pergunta 1, busca o lugar, escolhe e "Confirmar local" leva à pergunta 2 (tarefa 0041)', async () => {
    const router = renderAt('/onde')

    await userEvent.type(await screen.findByRole('combobox', { name: 'Buscar cidade, estrada ou endereço' }), 'uberaba')
    await userEvent.click(await screen.findByRole('option', { name: /Uberaba/ }))
    const confirm = screen.getByRole('button', { name: 'Confirmar local' })
    await vi.waitFor(() => expect(confirm).toBeEnabled())
    await userEvent.click(confirm)

    await vi.waitFor(() =>
      expect(`${router.state.location.pathname}${router.state.location.search}`).toBe('/quando?lat=-19.748&lon=-47.932'),
    )
  })

  it('"Próximo passo" na pergunta 2 abre a missão do satélite (RF-19)', async () => {
    renderAt('/quando?lat=-18.9543&lon=-48.1993')

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
    // A tela espera o raio-X: abre já com o painel, sem os cartões de antes passarem na frente.
    expect(await screen.findByRole('heading', { name: 'Raio-X da sua terra' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Terra média' })).not.toBeInTheDocument()
  })

  it('a missão sem a colheita volta para a pergunta 2', async () => {
    renderAt('/calculando?lat=-18.9543&lon=-48.1993')

    expect(await screen.findByRole('heading', { level: 1, name: 'Quando você colhe a soja?' })).toBeInTheDocument()
  })

  it('a tela 4 sem a colheita volta para a pergunta 2', async () => {
    renderAt('/satelite?lat=-18.9543&lon=-48.1993')

    expect(await screen.findByRole('heading', { level: 1, name: 'Quando você colhe a soja?' })).toBeInTheDocument()
  })

  it('"Ver o que plantar" na tela 4 abre a resposta com a melhor opção', async () => {
    renderAt('/satelite?lat=-18.9543&lon=-48.1993&colheita=meio')

    await userEvent.click(await screen.findByRole('button', { name: 'Ver o que plantar' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Milho com braquiária' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sugestão' })).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe('Raiz Orbital – Sugestão')
  })

  it('a resposta sem a colheita volta para a pergunta 2', async () => {
    renderAt('/resposta?lat=-18.9543&lon=-48.1993')

    expect(await screen.findByRole('heading', { level: 1, name: 'Quando você colhe a soja?' })).toBeInTheDocument()
  })

  it('a aba "Comparar" abre a tela 6 mantendo o caminho e o objetivo', async () => {
    renderAt('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio&objetivo=terra')

    await userEvent.click(await screen.findByRole('link', { name: 'Comparar' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Comparar' })).toBeInTheDocument()
    // Tarefa 0045: as 3 melhores do objetivo lado a lado, numa tabela.
    expect(await screen.findByRole('table', { name: /Lado a lado: Crotalária/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Comparar' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Cuidar da terra' })).toHaveAttribute('aria-pressed', 'true')
    expect(document.title).toBe('Raiz Orbital – Comparar')
  })

  it('a aba "Plano de 3 anos" abre a linha do tempo do plano', async () => {
    renderAt('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')

    await userEvent.click(await screen.findByRole('link', { name: 'Plano de 3 anos' }))

    // Tarefa 0045: o plano editável, ano a ano, com as notas ao lado do "Como é hoje" (GET /api/plano de exemplo).
    expect(await screen.findByRole('list', { name: 'Seu plano ano a ano' })).toHaveTextContent('2027Milho com braquiária')
    expect(await screen.findByRole('table', { name: 'Notas do seu plano ao lado de como é hoje' })).toBeInTheDocument()
    expect(screen.queryByText(/Como teria sido em/)).not.toBeInTheDocument()
    expect(document.title).toBe('Raiz Orbital – Plano de 3 anos')
  })

  it('"Comunidade" no cabeçalho abre a tela 8 levando o caminho', async () => {
    renderAt('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')

    await userEvent.click(await screen.findByRole('link', { name: 'Comunidade' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Na sua região' })).toBeInTheDocument()
    // Modo de demonstração: os relatos de exemplo, cada um com o selo "Exemplo" (tarefa 0047).
    const nearby = await screen.findByRole('region', { name: 'Perto de você' })
    expect(within(nearby).getAllByText('Exemplo').length).toBeGreaterThan(0)
    expect(screen.getByRole('region', { name: 'Conte o que aconteceu aí' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute(
      'href',
      '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
    expect(document.title).toBe('Raiz Orbital – Na sua região')
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

  it('a safra passada virou o detalhe do ano no explorador: o endereço antigo abre a Sugestão com o ano', async () => {
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

  it('o cabeçalho de toda tela tem só Comunidade, Avisos e o idioma, sem o botão grande "Ouvir"', async () => {
    renderAt('/onde')

    await screen.findByRole('heading', { level: 1, name: 'Onde fica a lavoura?' })
    const banner = screen.getByRole('banner')
    expect(within(banner).queryByRole('button', { name: /Ouvir/ })).not.toBeInTheDocument()
    expect(within(banner).getByRole('link', { name: 'Comunidade' })).toBeInTheDocument()
    expect(within(banner).getByRole('link', { name: /^Avisos/ })).toBeInTheDocument()
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
