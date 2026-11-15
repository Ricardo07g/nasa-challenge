import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, Outlet, RouterProvider, ScrollRestoration } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChoosePlanController } from '../controllers/useChoosePlanController'
import { I18nProvider } from '../i18n/I18nProvider'
import { useI18n } from '../i18n/useI18n'
import type { PlanoParams, PlanoSugestaoParams } from '../models/plano'
import type { Recomendacao } from '../models/recomendacao'
import { buildRecomendacao, buildTalhao } from '../repositories/mocks/fixtures'
import { buildPlano, buildSugestao } from '../repositories/mocks/mockPlano'
import { buildRaioX } from '../repositories/mocks/raioXFixture'
import type { FarmService } from '../services/farmService'
import type { PlanService } from '../services/planService'
import { newTabName } from '../test/newTabName'
import { ChoosePlanView } from './ChoosePlanView'

const point = { lat: -18.9543, lon: -48.1993 }
const flow = 'lat=-18.9543&lon=-48.1993&colheita=tarde&data=2027-03-03'

function deps(rec: Recomendacao = buildRecomendacao({ ...point, colheita: 'tarde' }, 'pt')) {
  const farm: FarmService = { talhao: vi.fn(() => Promise.resolve(buildTalhao(point, 'pt'))), recomendacao: vi.fn(() => Promise.resolve(rec)) }
  const plan: PlanService = {
    suggest: vi.fn((params: PlanoSugestaoParams) => Promise.resolve(buildSugestao(params, 'pt'))),
    evaluate: vi.fn((params: PlanoParams) => Promise.resolve(buildPlano(params, 'pt'))),
  }
  return {
    farm,
    plan,
    raioX: { get: vi.fn((params) => Promise.resolve(buildRaioX(params, 'pt'))) },
    pastSeason: { get: vi.fn(() => new Promise<never>(() => {})) },
    speech: { isSupported: () => false, speak: vi.fn(), stop: vi.fn() },
  }
}

function makeScreen(d: ReturnType<typeof deps>) {
  return function Screen() {
    const { lang, messages: t } = useI18n()
    const state = useChoosePlanController(d)
    return <ChoosePlanView t={t} lang={lang} state={state} />
  }
}

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

/** O produtor já rolou a tela (o `ScrollRestoration` sobe a tela ao abrir). */
function scrolled() {
  scrollY = 600
}

/** A tela com a moldura do app (o `ScrollRestoration` sobe a tela a cada navegação sem `preventScrollReset`). */
function renderAt(url: string, d = deps(), lang: 'pt' | 'en' = 'pt') {
  const Screen = makeScreen(d)
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <ScrollRestoration />
            <Outlet />
          </>
        ),
        children: ['/resposta', '/opcoes', '/plano'].map((path) => ({ path, element: <Screen /> })),
      },
    ],
    { initialEntries: [url] },
  )
  render(
    <I18nProvider initialLang={lang}>
      <RouterProvider router={router} />
    </I18nProvider>,
  )
  return { router, d }
}

const here = (router: ReturnType<typeof createMemoryRouter>) => `${router.state.location.pathname}${router.state.location.search}`

describe('ChoosePlanView: topo e abas (tela 5)', () => {
  it('Voltar para o raio-X, o título, a safra com a colheita prevista e as 2 abas, sem "Imprimir relatório" (pacote 3)', async () => {
    renderAt(`/resposta?${flow}`)

    expect(await screen.findByRole('heading', { level: 1, name: 'O que plantar depois da soja' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', `/satelite?${flow}`)
    const top = screen.getByRole('heading', { level: 1 }).parentElement!
    expect(within(top).getByText('Safra 2026/27 · colheita prevista em 3 de março de 2027')).toBeInTheDocument()
    const tabs = screen.getByRole('tablist', { name: 'Etapas' })
    expect(within(tabs).getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['1Escolher', '2Plano de 3 anos'])
    expect(screen.getByRole('tab', { name: 'Escolher' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('tabpanel', { name: 'Escolher' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Imprimir relatório' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-print-report]')).toBeNull()
    expect(screen.queryByText(/Pergunta \d de/)).not.toBeInTheDocument()
  })

  it('a aba "Plano de 3 anos" troca o endereço sem rolar a tela, sem "Imprimir relatório"', async () => {
    const { router } = renderAt(`/resposta?${flow}`)

    const planTab = await screen.findByRole('tab', { name: 'Plano de 3 anos' })
    scrolled()
    await userEvent.click(planTab)
    await waitFor(() => expect(here(router)).toBe(`/plano?${flow}`))
    expect(window.scrollY).toBe(600)
    expect(await screen.findByRole('tabpanel', { name: 'Plano de 3 anos' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Imprimir relatório' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-print-report]')).toBeNull()
  })
})

describe('ChoosePlanView: aba "1. Escolher"', () => {
  it('"O que você quer mais?" com 3 botões; tocar marca, tocar de novo tira, sem rolar a tela', async () => {
    const { router } = renderAt(`/resposta?${flow}`)
    const group = await screen.findByRole('group', { name: 'O que você quer mais?' })
    const income = within(group).getByRole('button', { name: 'Renda' })
    scrolled()

    await userEvent.click(income)
    await waitFor(() => expect(here(router)).toContain('objetivo=renda'))
    expect(window.scrollY).toBe(600)
    expect(within(group).getByRole('button', { name: 'Renda' })).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(within(group).getByRole('button', { name: 'Renda' }))
    await waitFor(() => expect(here(router)).not.toContain('objetivo='))
  })

  it('o cartão da sugestão: foto com crédito, nome, deu certo e "Usar no meu plano" vira "✓ Está no seu plano"', async () => {
    renderAt(`/resposta?${flow}&pensa=sorgo`)
    const card = (await screen.findByRole('heading', { level: 2, name: 'Milho com braquiária' })).closest('article')!

    expect(within(card).getByText('Nossa sugestão')).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: newTabName('Ethan Bass') })).toHaveAttribute('target', '_blank')
    expect(card).toHaveTextContent(/Deu certo em \d+ de 20 anos/)
    const use = within(card).getByRole('button', { name: 'Usar no meu plano' })
    expect(use).toHaveAttribute('aria-pressed', 'false')
    scrolled()

    await userEvent.click(use)
    expect(within(card).getByRole('button', { name: '✓ Está no seu plano' })).toHaveAttribute('aria-pressed', 'true')
    expect(window.scrollY).toBe(600)
  })

  it('"Por que essa sugestão?" abre o modal grande com os blocos e o "Saiba mais" em nova aba', async () => {
    renderAt(`/resposta?${flow}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Por que essa sugestão?' }))

    const dialog = screen.getByRole('dialog', { name: 'Milho com braquiária' })
    expect(within(dialog).getByRole('heading', { name: 'Deu certo ano a ano' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Água' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Clima de 2041 a 2060' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Renda e terra' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Como fazer' })).toBeInTheDocument()
    expect(within(dialog).getByText('Rascunho: a revisar pela agrônoma.')).toBeInTheDocument()
    const learn = within(dialog).getByRole('link', { name: newTabName('Saiba mais: O que significa "deu certo"') })
    expect(learn).toHaveAttribute('href', '/guia/deu-certo')
    expect(learn).toHaveAttribute('target', '_blank')

    const bars = within(dialog).getByRole('group', { name: /Deu certo em/ })
    const year = within(bars).getAllByRole('button')[10]
    await userEvent.click(year)
    expect(year).toHaveAttribute('aria-pressed', 'true')
    expect(await within(dialog).findByRole('region', { name: /O que aconteceu em \d{4}/ })).toBeInTheDocument()
  })

  it('o seletor "Comparar:" tem as 6 culturas, com as etiquetas; já vêm marcadas a escolha e a sugestão', async () => {
    renderAt(`/resposta?${flow}&pensa=sorgo`)
    const picker = await screen.findByRole('group', { name: 'Comparar:' })
    const boxes = within(picker).getAllByRole('checkbox')

    expect(boxes).toHaveLength(6)
    expect(within(picker).getByRole('checkbox', { name: /^Sorgo ?sua escolha/ })).toBeChecked()
    expect(within(picker).getByRole('checkbox', { name: /^Milho com braquiária ?sugestão/ })).toBeChecked()
    expect(within(picker).getByRole('checkbox', { name: /^Milho sozinho ?fora do prazo/ })).not.toBeChecked()
    expect(within(picker).getByRole('checkbox', { name: /^Deixar parado/ })).not.toBeChecked()
  })

  it('marcar uma caixinha põe a cultura na comparação sem rolar; com 3, as outras desligam', async () => {
    renderAt(`/resposta?${flow}&pensa=sorgo`)
    const picker = await screen.findByRole('group', { name: 'Comparar:' })
    scrolled()

    await userEvent.click(within(picker).getByRole('checkbox', { name: /^Milho sozinho/ }))
    expect(window.scrollY).toBe(600)
    const region = screen.getByRole('region', { name: 'Comparação lado a lado' })
    await waitFor(() => expect(within(region).getAllByRole('group')).toHaveLength(3))
    expect(within(picker).getByRole('checkbox', { name: /^Milheto/ })).toBeDisabled()
    expect(within(region).getByRole('group', { name: 'Milho sozinho' })).toHaveTextContent('Passou do prazo')
  })

  it('toda célula abre um modal; o do prazo explica o ZARC e o seguro, com o aviso da cultura fora do prazo', async () => {
    renderAt(`/resposta?${flow}&comparar=milho_safrinha,sorgo`)
    const region = await screen.findByRole('region', { name: 'Comparação lado a lado' })
    const late = within(region).getByRole('group', { name: 'Milho sozinho' })

    await userEvent.click(within(late).getByRole('button', { name: /Prazo para plantar/ }))
    const dialog = screen.getByRole('dialog', { name: 'Prazo para plantar' })
    expect(dialog).toHaveTextContent('Passou do prazo (28 de fevereiro)')
    expect(dialog).toHaveTextContent(/o seguro rural não cobre/)
    expect(dialog).toHaveTextContent(/ZARC é o Zoneamento Agrícola de Risco Climático/)
    expect(dialog).toHaveTextContent('ZARC (Ministério da Agricultura) e Embrapa.')
    await userEvent.keyboard('{Escape}')

    await userEvent.click(within(late).getByRole('button', { name: /^Deu certo/ }))
    expect(screen.getByRole('dialog', { name: 'Deu certo' })).toHaveTextContent(/GPM IMERG/)
  })

  it('"Essa é a escolha para o meu plano": escolha única, até de cultura fora do prazo, e a frase do plano muda', async () => {
    const { router } = renderAt(`/resposta?${flow}&comparar=milho_safrinha,sorgo`)
    const region = await screen.findByRole('region', { name: 'Comparação lado a lado' })
    const late = within(region).getByRole('group', { name: 'Milho sozinho' })
    scrolled()

    await userEvent.click(within(late).getByRole('button', { name: 'Essa é a escolha para o meu plano' }))
    await waitFor(() => expect(here(router)).toContain('escolha=milho_safrinha'))
    expect(within(late).getByRole('button', { name: 'Escolha do meu plano' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/No seu plano, depois da soja 2026\/27:/).closest('p')).toHaveTextContent('Milho sozinho')
    expect(window.scrollY).toBe(600)
  })

  it('"Ver o plano de 3 anos" abre a aba 2 começando do topo', async () => {
    const { router } = renderAt(`/resposta?${flow}`)
    const go = await screen.findByRole('button', { name: /Ver o plano de 3 anos/ })
    scrolled()
    await userEvent.click(go)
    await waitFor(() => expect(here(router)).toBe(`/plano?${flow}`))
    expect(window.scrollY).toBe(0)
  })
})

describe('ChoosePlanView: aba "2. Plano de 3 anos"', () => {
  it('os 3 cartões (safra, foto, etiqueta, porquê) e o select de cada ano', async () => {
    renderAt(`/plano?${flow}&escolha=sorgo`)
    const years = await screen.findByRole('list', { name: 'Seu plano ano a ano' })
    const cards = within(years).getAllByRole('listitem')

    expect(cards).toHaveLength(3)
    expect(cards[0]).toHaveTextContent('Depois da soja 2026/27')
    expect(cards[0]).toHaveTextContent('mar–jul de 2027')
    expect(cards[0]).toHaveTextContent('Sua escolha')
    expect(cards[1]).toHaveTextContent('Depois da soja 2027/28')
    expect(cards[1]).toHaveTextContent('Nossa sugestão')
    expect(cards[1]).toHaveTextContent(/Por quê:/)
    expect(within(cards[2]).getByRole('combobox', { name: 'O que plantar depois da soja 2028/29' })).toHaveValue('sorgo')
  })

  it('mudar o 2º ano refaz o 3º e mostra o alerta com "Voltar ao plano sugerido", sem rolar', async () => {
    const { router } = renderAt(`/plano?${flow}&escolha=sorgo`)
    const select = await screen.findByRole('combobox', { name: 'O que plantar depois da soja 2027/28' })
    scrolled()

    await userEvent.selectOptions(select, 'pousio')
    expect(window.scrollY).toBe(600)
    const alert = await screen.findByText(/Você mudou 2027\/28 para/)
    await waitFor(() => expect(alert.closest('p')).toHaveTextContent('Para 2028/29 agora sugerimos Milheto: a terra ficou descoberta'))

    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao plano sugerido' }))
    await waitFor(() => expect(here(router)).not.toContain('ano2='))
  })

  it('as notas: "Como é hoje" não preenchido, com o aviso e o "Preencher agora" que abre o modal', async () => {
    renderAt(`/plano?${flow}`)
    const table = await screen.findByRole('table', { name: 'Notas do seu plano ao lado de como é hoje' })
    expect(within(table).getAllByText('não preenchido')).toHaveLength(3)

    await userEvent.click(screen.getByRole('button', { name: 'Preencher agora' }))
    expect(screen.getByRole('dialog', { name: 'Suas últimas safras' })).toBeInTheDocument()
  })

  it('"Como é hoje" com "Não plantei": a coluna diz que não dá para comparar, sem o aviso de não preenchido', async () => {
    renderAt(`/plano?${flow}&safras=2024:sem_soja,2025:pousio,2026:sorgo`)
    const table = await screen.findByRole('table', { name: 'Notas do seu plano ao lado de como é hoje' })
    expect(table).toHaveTextContent('Sem soja em 2023/24: não dá para comparar')
    expect(screen.queryByRole('button', { name: 'Preencher agora' })).not.toBeInTheDocument()
  })

  it('cada nota abre o modal com a conta', async () => {
    renderAt(`/plano?${flow}&safras=2024:milho_braquiaria,2025:pousio,2026:sorgo`)
    const table = await screen.findByRole('table', { name: 'Notas do seu plano ao lado de como é hoje' })
    await waitFor(() => expect(within(table).getAllByRole('button')[0]).toHaveTextContent(/de 100/))

    await userEvent.click(within(table).getAllByRole('button')[0])
    expect(screen.getByRole('dialog', { name: 'Segurança' })).toHaveTextContent(/média da nota de segurança/)
  })

  it('chuva aproveitada, "E se o ano vier seco?" com o Plano B do motor e "Ver meu planejamento"', async () => {
    renderAt(`/plano?${flow}&escolha=sorgo`)
    expect(await screen.findByRole('list', { name: 'Chuva que a lavoura usa em cada ano' })).toHaveTextContent('Terra parada')
    const dry = screen.getByRole('heading', { name: 'E se o ano vier seco?' }).closest('section')!
    expect(dry).toHaveTextContent('Plano A')
    expect(dry).toHaveTextContent('Plano B')
    expect(dry).toHaveTextContent('Crotalária')
    expect(within(dry).getByRole('link', { name: newTabName('Saiba mais: veranico') })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: /Ver meu planejamento/ })).toHaveAttribute('href', `/planejamento?${flow}&escolha=sorgo`)
  })

  it('a frase antes de "Ver meu planejamento" fala do relatório para imprimir, em pt e en (pacote 3)', async () => {
    renderAt(`/plano?${flow}`)
    expect(await screen.findByText('Pronto para ver tudo junto: alertas, o que fazer depois e o relatório para imprimir.')).toBeInTheDocument()
  })

  it('a frase nova em inglês', async () => {
    renderAt(`/plano?${flow}`, deps(), 'en')
    expect(await screen.findByText('Ready to see it all together: alerts, what to do next and the report to print.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /See my plan/ })).toBeInTheDocument()
  })
})
