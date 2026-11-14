import { render, screen } from '@testing-library/react'
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

  it('"Próximo passo" na pergunta 2 abre a tela 4 com o que o satélite viu', async () => {
    renderAt('/quando?lat=-18.9543&lon=-48.1993')

    await userEvent.click(await screen.findByRole('button', { name: 'Próximo passo Ver a resposta' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pronto. O satélite já viu o resto.' }),
    ).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Terra média' })).toBeInTheDocument()
    expect(document.title).toBe('Raiz Orbital – Pronto. O satélite já viu o resto.')
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

  it('endereço desconhecido volta ao início', async () => {
    renderAt('/nao-existe')

    expect(await screen.findByRole('heading', { level: 1, name: 'O que plantar depois da soja?' })).toBeInTheDocument()
  })
})
