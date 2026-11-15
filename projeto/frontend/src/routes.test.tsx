import { cleanup, render, screen } from '@testing-library/react'
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
    expect(screen.getByRole('link', { name: 'Resposta' })).toHaveAttribute(
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
    expect(await screen.findByRole('button', { name: /Meio de fevereiro/ })).toHaveAttribute('aria-pressed', 'true')
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
    expect(await screen.findByRole('heading', { name: 'Terra média' })).toBeInTheDocument()
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
    expect(screen.getByRole('link', { name: 'Resposta' })).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe('Raiz Orbital – A melhor opção')
  })

  it('a resposta sem a colheita volta para a pergunta 2', async () => {
    renderAt('/resposta?lat=-18.9543&lon=-48.1993')

    expect(await screen.findByRole('heading', { level: 1, name: 'Quando você colhe a soja?' })).toBeInTheDocument()
  })

  it('a aba "Todas as opções" abre a tela 6 mantendo o caminho', async () => {
    renderAt('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')

    await userEvent.click(await screen.findByRole('link', { name: 'Todas as opções' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Todas as opções' })).toBeInTheDocument()
    expect(await screen.findByRole('article', { name: 'Milho com braquiária' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Todas as opções' })).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe('Raiz Orbital – Todas as opções')
  })

  it('a aba "Plano de 3 anos" abre a linha do tempo do plano', async () => {
    renderAt('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')

    await userEvent.click(await screen.findByRole('link', { name: 'Plano de 3 anos' }))

    expect(await screen.findByRole('list', { name: 'Plano ano a ano' })).toHaveTextContent('2027Milho com braquiária')
    expect(document.title).toBe('Raiz Orbital – Plano de 3 anos')
  })

  it('"Comunidade" no cabeçalho abre a tela 8 levando o caminho', async () => {
    renderAt('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')

    await userEvent.click(await screen.findByRole('link', { name: 'Comunidade' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Na sua região' })).toBeInTheDocument()
    expect(await screen.findByText('Até 30 km de Uberlândia · 18 produtores participando')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute(
      'href',
      '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
    expect(document.title).toBe('Raiz Orbital – Na sua região')
  })

  it('"Sou agrônomo(a)" no rodapé abre a tela 9 com as notas da lavoura', async () => {
    renderAt('/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')

    await userEvent.click(await screen.findByRole('link', { name: /Sou agrônomo\(a\)/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Como a conta é feita' })).toBeInTheDocument()
    expect(await screen.findByRole('table', { name: 'Notas de cada opção (0 a 100)' })).toBeInTheDocument()
    expect(document.title).toBe('Raiz Orbital – Como a conta é feita')
  })

  it('o relatório abre pela URL com a folha para imprimir', async () => {
    renderAt('/relatorio?lat=-18.9543&lon=-48.1993&colheita=meio')

    expect(await screen.findByRole('article', { name: 'Relatório da lavoura · Raiz Orbital' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar em PDF' })).toBeInTheDocument()
    expect(document.title).toBe('Raiz Orbital – Relatório da lavoura · Raiz Orbital')
  })

  it('o replay da safra passada abre pela URL', async () => {
    renderAt('/safra-passada?lat=-18.9543&lon=-48.1993&colheita=meio&ano=2024')

    expect(await screen.findByRole('heading', { level: 1, name: 'Como teria sido a safrinha de 2024' })).toBeInTheDocument()
    expect(await screen.findByRole('list', { name: 'Como teria sido a safrinha de 2024' })).toBeInTheDocument()
  })

  it('toda tela tem o rodapé com o aviso e o caminho do agrônomo', async () => {
    renderAt('/onde')

    const footer = await screen.findByRole('contentinfo')
    expect(footer).toHaveTextContent('Ajuda a decidir. Não substitui o seu agrônomo.')
    expect(screen.getByRole('link', { name: 'Sou agrônomo(a): como a conta é feita' })).toHaveAttribute(
      'href',
      '/como-funciona',
    )
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

  it('"Ver um exemplo pronto" vai para a resposta da fazenda de exemplo', async () => {
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
})
