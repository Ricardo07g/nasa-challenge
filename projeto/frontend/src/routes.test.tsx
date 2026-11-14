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
        '/resposta?lat=-18.92&lon=-48.28&colheita=meio&exemplo=1',
      ),
    )
  })

  it('endereço desconhecido volta ao início', async () => {
    renderAt('/nao-existe')

    expect(await screen.findByRole('heading', { level: 1, name: 'O que plantar depois da soja?' })).toBeInTheDocument()
  })
})
