import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, ScrollRestoration, useNavigate, useSearchParams } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pt } from '../i18n/messages.pt'
import { readFlowParams } from '../services/flowParams'
import { flowWithSeasonAnswers, seasonAnswersFromFlow, withSeasonAnswer } from '../services/seasonAnswersService'
import { SeasonAnswersForm } from '../views/SeasonAnswersForm'
import { useReplaceFlow, useReplaceUrl } from './useReplaceFlow'

/**
 * Regra geral 2 do pacote 2: clicar numa opção nunca mexe na rolagem. O roteador (com o `ScrollRestoration`
 * da moldura, como no `ShellPage`) sobe a tela a cada navegação, a não ser com `preventScrollReset`.
 */

let scrollY = 0

beforeEach(() => {
  scrollY = 0
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => scrollY)
  vi.spyOn(window, 'scrollTo').mockImplementation(((x: number | ScrollToOptions, y?: number) => {
    scrollY = typeof x === 'number' ? (y ?? 0) : (x.top ?? 0)
  }) as typeof window.scrollTo)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function FlowOption() {
  const replaceFlow = useReplaceFlow()
  return (
    <button type="button" onClick={() => replaceFlow({ lat: -18.9, lon: -48.2, safras: '2024:sorgo' })}>
      Sorgo
    </button>
  )
}

function UrlOption() {
  const replaceUrl = useReplaceUrl()
  return (
    <button type="button" onClick={() => replaceUrl('/satelite?lat=-18.9&lon=-48.2&pensa=milheto')}>
      Milheto
    </button>
  )
}

/** Uma tela com o formulário das safras ligado à URL, como as telas 4 e 5 vão fazer. */
function SeasonsPage() {
  const replaceFlow = useReplaceFlow()
  const [search] = useSearchParams()
  const flow = readFlowParams(search)!
  const answers = seasonAnswersFromFlow(flow)
  return (
    <SeasonAnswersForm
      t={pt}
      lang="pt"
      seasons={[{ year: 2024, satellite: null }]}
      answers={answers}
      onAnswer={(year, answer) => replaceFlow(flowWithSeasonAnswers(flow, withSeasonAnswer(answers, year, answer)))}
    />
  )
}

function PlainOption() {
  const navigate = useNavigate()
  return (
    <button type="button" onClick={() => navigate('/satelite?lat=-18.9&lon=-48.2&pensa=sorgo', { replace: true })}>
      Navegar comum
    </button>
  )
}

function renderAt(element: React.ReactNode) {
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <ScrollRestoration />
            <Outlet />
          </>
        ),
        children: [{ path: '/satelite', element }],
      },
    ],
    { initialEntries: ['/satelite?lat=-18.9&lon=-48.2'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

/** A pessoa rolou a tela até as perguntas. */
function scrollDown() {
  act(() => window.scrollTo(0, 640))
  expect(window.scrollY).toBe(640)
}

describe('useReplaceFlow / useReplaceUrl (navegar sem rolar)', () => {
  it('sem o helper, o roteador sobe a tela a cada clique (o problema do "Plantei / Não plantei")', async () => {
    renderAt(<PlainOption />)
    scrollDown()

    await userEvent.click(screen.getByRole('button', { name: 'Navegar comum' }))

    expect(window.scrollY).toBe(0)
  })

  it('grava o fluxo na URL da mesma tela, trocando a entrada do histórico, e a rolagem fica onde está', async () => {
    const router = renderAt(<FlowOption />)
    scrollDown()

    await userEvent.click(screen.getByRole('button', { name: 'Sorgo' }))

    expect(router.state.location.pathname).toBe('/satelite')
    expect(router.state.location.search).toBe('?lat=-18.9&lon=-48.2&safras=2024:sorgo')
    expect(router.state.historyAction).toBe('REPLACE')
    expect(window.scrollY).toBe(640)
  })

  it('no formulário das safras: clicar numa opção grava a resposta na URL e a tela não sobe', async () => {
    const router = renderAt(<SeasonsPage />)
    scrollDown()

    await userEvent.click(screen.getByRole('button', { name: 'Plantei' }))
    expect(router.state.location.search).toBe('?lat=-18.9&lon=-48.2&safras=2024:soja')
    await userEvent.click(screen.getByRole('button', { name: 'Deixei parado' }))

    expect(router.state.location.search).toBe('?lat=-18.9&lon=-48.2&safras=2024:pousio')
    expect(window.scrollY).toBe(640)
  })

  it('troca para um endereço pronto sem rolar', async () => {
    const router = renderAt(<UrlOption />)
    scrollDown()

    await userEvent.click(screen.getByRole('button', { name: 'Milheto' }))

    expect(router.state.location.search).toBe('?lat=-18.9&lon=-48.2&pensa=milheto')
    expect(router.state.historyAction).toBe('REPLACE')
    expect(window.scrollY).toBe(640)
  })
})
