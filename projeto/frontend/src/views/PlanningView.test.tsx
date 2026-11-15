import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { usePlanningController, type PlanningDeps } from '../controllers/usePlanningController'
import { I18nProvider } from '../i18n/I18nProvider'
import { useI18n } from '../i18n/useI18n'
import type { PlanoParams, PlanoSugestaoParams } from '../models/plano'
import type { RaioX } from '../models/raioX'
import { ApiError } from '../repositories/httpClient'
import { buildRecomendacao, buildTalhao } from '../repositories/mocks/fixtures'
import { buildPlano, buildSugestao } from '../repositories/mocks/mockPlano'
import { buildRaioX } from '../repositories/mocks/raioXFixture'
import type { FarmService } from '../services/farmService'
import type { PlanService } from '../services/planService'
import { newTabName } from '../test/newTabName'
import { PlanningView } from './PlanningView'

const point = { lat: -18.9543, lon: -48.1993 }
const flow = 'lat=-18.9543&lon=-48.1993&colheita=tarde&data=2027-03-03'
const demo = `${flow}&exemplo=1&safras=2024:milho_braquiaria,2025:pousio,2026:sorgo&pensa=sorgo&escolha=sorgo`

function planningDeps(raio: (params: Parameters<typeof buildRaioX>[0]) => Promise<RaioX> = (params) => Promise.resolve(buildRaioX(params, 'pt'))) {
  const farm: FarmService = {
    talhao: vi.fn(() => Promise.resolve(buildTalhao(point, 'pt'))),
    recomendacao: vi.fn((params) => Promise.resolve(buildRecomendacao({ ...point, colheita: params.colheita }, 'pt'))),
  }
  const plan: PlanService = {
    suggest: vi.fn((params: PlanoSugestaoParams) => Promise.resolve(buildSugestao(params, 'pt'))),
    evaluate: vi.fn((params: PlanoParams) => Promise.resolve(buildPlano(params, 'pt'))),
  }
  const d = {
    farm,
    plan,
    raioX: { get: vi.fn(raio) },
    geocoding: { reverse: vi.fn(() => Promise.resolve(null)) },
    speech: { isSupported: () => true, speak: vi.fn(), stop: vi.fn() },
    print: vi.fn(),
    today: () => '2026-11-15',
  } satisfies PlanningDeps
  return d
}

/** A tela inteira, com o controller de verdade e os services falsos. */
async function renderPlanning(url: string, d = planningDeps(), lang: 'pt' | 'en' = 'pt') {
  function Screen() {
    const { lang: current, messages: t } = useI18n()
    const state = usePlanningController(d)
    return <PlanningView t={t} lang={current} state={state} />
  }
  render(
    <I18nProvider initialLang={lang}>
      <MemoryRouter initialEntries={[url]}>
        <Screen />
      </MemoryRouter>
    </I18nProvider>,
  )
  await screen.findByRole('heading', { level: 1 })
  await waitFor(() => expect(document.querySelector('[data-print-report]')).not.toBeNull())
  return d
}

const report = () => document.querySelector('[data-print-report]') as HTMLElement

describe('PlanningView: topo e resumo do plano (tela 6)', () => {
  it('"← Voltar ao plano", o selo de pronto, o título, o lugar com a colheita e o "Ouvir resumo"', async () => {
    await renderPlanning(`/planejamento?${demo}`)

    expect(screen.getByRole('link', { name: 'Voltar ao plano' })).toHaveAttribute('href', `/plano?${demo}`)
    expect(screen.getByText('Seu planejamento está pronto')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Seu planejamento' })).toBeInTheDocument()
    expect(screen.getByText(/Lavoura de demonstração, perto de Uberlândia \(MG\) · colheita da soja prevista em/)).toHaveTextContent(
      '3 de março de 2027',
    )
    expect(screen.getByRole('button', { name: 'Ouvir resumo' })).toBeInTheDocument()
  })

  it('fora da demonstração, o lugar da tela 1; só com a época, a colheita pela época', async () => {
    await renderPlanning('/planejamento?lat=-18.9543&lon=-48.1993&colheita=meio')
    expect(screen.getByText('Sua lavoura, perto de Uberlândia (MG) · colheita da soja prevista no meio de fevereiro')).toBeInTheDocument()
  })

  it('os blocos na ordem: resumo, linha do tempo, alertas, passado e futuro, comunidade e relatório', async () => {
    await renderPlanning(`/planejamento?${demo}`)
    const titles = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(titles).toEqual([
      'O que fazer agora',
      'Alertas da sua área',
      'Seu plano: o que já aconteceu e o que vem',
      'Comunidade da sua região',
      'Relatório do seu planejamento',
    ])
    expect(screen.getByRole('region', { name: 'Seu plano de 3 anos' }).compareDocumentPosition(screen.getByRole('region', { name: 'O que fazer agora' }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
  })

  it('um cartão por ano (foto, safra, meses, cultura e deu certo) e as ações: imprimir e mudar o plano', async () => {
    const d = await renderPlanning(`/planejamento?${demo}`)
    const summary = screen.getByRole('region', { name: 'Seu plano de 3 anos' })
    const years = within(summary).getAllByRole('article')
    expect(years).toHaveLength(3)
    expect(years[0]).toHaveTextContent('Depois da soja 2026/27')
    expect(years[0]).toHaveTextContent('mar–jul de 2027')
    expect(within(years[0]).getByRole('heading', { name: 'Sorgo' })).toBeInTheDocument()
    expect(years[0]).toHaveTextContent('Deu certo em 17 de 20 anos')
    expect(within(years[0]).getByRole('img')).toBeInTheDocument()
    expect(years[1]).toHaveTextContent('Depois da soja 2027/28')
    expect(years[2]).toHaveTextContent('mar–jul de 2029')

    expect(within(summary).getByText('Guarde o plano e leve para conversar com o seu agrônomo.')).toBeInTheDocument()
    expect(within(summary).getByRole('link', { name: 'Mudar o plano' })).toHaveAttribute('href', `/plano?${demo}`)
    await userEvent.click(within(summary).getByRole('button', { name: 'Imprimir relatório' }))
    expect(d.print).toHaveBeenCalledTimes(1)
  })
})

describe('PlanningView: "O que fazer agora"', () => {
  it('os passos por regra, com as datas da colheita e do ZARC, "agora" e o Plano B; sem "Adicionar à agenda"', async () => {
    await renderPlanning(`/planejamento?${demo}`)
    const steps = within(screen.getByRole('region', { name: 'O que fazer agora' })).getAllByRole('listitem')

    expect(steps.map((step) => step.querySelector('h3')?.textContent)).toEqual([
      'Cuide da soja e fique de olho nos avisos',
      'Confira o sinal do outono',
      'Colha a soja',
      'Plante sorgo',
      'Fase em que a planta mais precisa de água',
      'Colha e deixe a palha no chão',
      'Próxima soja; depois dela, milheto',
    ])
    expect(steps[0]).toHaveTextContent('Agoranov–mar')
    expect(steps[0]).toHaveTextContent('agora')
    expect(steps[1]).toHaveTextContent('Fevereiro2027')
    expect(steps[1]).toHaveTextContent('Plano B: crotalária')
    expect(steps[2]).toHaveTextContent('3 marcolheita')
    expect(steps[3]).toHaveTextContent('até 20 marprazo ZARC')
    expect(steps[3]).toHaveTextContent('o prazo do ZARC vai até 20 de março')
    expect(steps[4]).toHaveTextContent('abr–maifloração')
    expect(steps[6]).toHaveTextContent('out–nov2027')
    expect(screen.queryByText(/agenda/i)).not.toBeInTheDocument()
  })

  it('o 1º ano fora do prazo mostra o aviso laranja', async () => {
    await renderPlanning(`/planejamento?${flow}&exemplo=1&escolha=milho_safrinha`)
    const plant = within(screen.getByRole('region', { name: 'O que fazer agora' }))
      .getAllByRole('listitem')
      .find((step) => step.querySelector('h3')?.textContent === 'Plante milho sozinho')!
    expect(plant).toHaveAttribute('data-late', 'true')
    expect(plant).toHaveTextContent('Passou do prazo do ZARC (28 de fevereiro): o risco sobe e o seguro rural pode não cobrir.')
  })
})

describe('PlanningView: alertas, passado e futuro, comunidade e relatório', () => {
  it('alertas: Agora e chuva forte (o fogo sem dado não aparece), "Saiba mais" em nova aba e a faixa da Defesa Civil', async () => {
    await renderPlanning(`/planejamento?${flow}&exemplo=1`)
    const section = screen.getByRole('region', { name: 'Alertas da sua área' })
    const cards = within(section).getAllByRole('article')

    expect(cards.map((card) => card.querySelector('[data-label]')?.textContent)).toEqual(['Agora', 'Chuva forte'])
    expect(cards[0]).toHaveTextContent('O que fazer: confira o sinal em fevereiro, antes de plantar.')
    expect(cards[0]).toHaveTextContent('Fonte: NOAA, 12 de novembro de 2026')
    expect(cards[1]).toHaveTextContent('Em 20 anos, houve 6 dias com 50 mm ou mais de chuva em fevereiro e março.')
    const erosion = within(cards[1]).getByRole('link', { name: newTabName('Saiba mais: como evitar erosão') })
    expect(erosion).toHaveAttribute('href', '/guia/como-evitar-erosao')
    expect(erosion).toHaveAttribute('target', '_blank')
    expect(within(section).queryByText('Fogo')).not.toBeInTheDocument()

    expect(within(section).getByRole('link', { name: /Ver todos os avisos/ })).toHaveAttribute('href', `/avisos?${flow}&exemplo=1`)
    expect(within(section).getByText('Estes avisos não substituem a Defesa Civil.')).toBeInTheDocument()
    expect(within(section).getByRole('link', { name: 'Ver alertas oficiais' })).toHaveAttribute('href', `/avisos?${flow}&exemplo=1#alertas-oficiais`)
  })

  it('passado e futuro: deu certo por ano do plano (2005–2024 e 2041–2060) e o clima de 2041 a 2060', async () => {
    await renderPlanning(`/planejamento?${demo}`)
    const section = screen.getByRole('region', { name: 'Seu plano: o que já aconteceu e o que vem' })
    const rows = within(within(section).getByRole('table')).getAllByRole('row').slice(1)

    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('Sorgo2026/27')
    expect(rows[0]).toHaveTextContent('17 de 20')
    expect(section).toHaveTextContent('-4,5%')
    expect(section).toHaveTextContent('+1,6 °C')
    expect(section).toHaveTextContent('2 de 3 modelos indicam menos chuva; 3 de 3, mais calor.')
    expect(section).toHaveTextContent('cenário intermediário (SSP2-4.5)')
    expect(within(section).getByRole('link', { name: newTabName('Saiba mais: o clima de 2041 a 2060') })).toHaveAttribute(
      'href',
      '/guia/clima-2041-2060',
    )
  })

  it('sem o raio-X, o alerta de chuva forte não aparece', async () => {
    await renderPlanning(`/planejamento?${flow}&exemplo=1`, planningDeps(() => Promise.reject(new Error('fora do ar'))))
    const section = screen.getByRole('region', { name: 'Alertas da sua área' })
    expect(within(section).getAllByRole('article').map((card) => card.querySelector('[data-label]')?.textContent)).toEqual(['Agora'])
  })

  it('comunidade "em breve" com o Guia: nenhum link para a comunidade', async () => {
    await renderPlanning(`/planejamento?${demo}`)
    const section = screen.getByRole('region', { name: 'Comunidade da sua região' })
    expect(within(section).getByText('Em breve')).toBeInTheDocument()
    expect(within(section).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'O que os vizinhos plantaram depois da soja',
      'Quanto choveu em cada lavoura',
      'O que aconteceu perto de você',
    ])
    expect(within(section).getByText('Enquanto isso, o Guia explica cada cultura, o plantio e o clima.')).toBeInTheDocument()
    expect(within(section).getByRole('link', { name: 'Abrir o Guia' })).toHaveAttribute('href', '/guia')
    expect(document.querySelector('a[href^="/comunidade"]')).toBeNull()
  })

  it('o cartão do relatório, "Imprimir relatório" e "Tem outra lavoura?"', async () => {
    const d = await renderPlanning(`/planejamento?${demo}`)
    const card = screen.getByRole('region', { name: 'Relatório do seu planejamento' })
    expect(within(card).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Sua terra',
      'Últimas safras',
      'Opções comparadas',
      'Plano de 3 anos',
      'O que fazer e quando',
      'Alertas e clima',
    ])
    await userEvent.click(within(card).getByRole('button', { name: 'Imprimir relatório' }))
    expect(d.print).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: 'Fazer um novo planejamento' })).toHaveAttribute('href', '/onde')
  })

  it('sem as últimas safras: o aviso com "Preencher agora" no cartão do relatório', async () => {
    await renderPlanning(`/planejamento?${flow}&exemplo=1`)
    const card = screen.getByRole('region', { name: 'Relatório do seu planejamento' })
    expect(within(card).getByRole('button', { name: 'Preencher agora' })).toBeInTheDocument()
  })
})

describe('PlanningView: relatório para imprimir (7 seções)', () => {
  it('fica no <body>, escondido na tela, com o cabeçalho e as 7 seções, prós e contras de cada ano', async () => {
    await renderPlanning(`/planejamento?${demo}`)
    const r = report()

    expect(r.parentElement).toBe(document.body)
    expect(r).toHaveAttribute('hidden')
    expect(r.querySelector('header')).toBeNull()
    expect(within(r).getByRole('heading', { level: 1, hidden: true })).toHaveTextContent('Raiz Orbital · Relatório do planejamento')
    expect(r).toHaveTextContent('Lavoura de demonstração, perto de Uberlândia (MG) · -18.9543, -48.1993')
    expect(r).toHaveTextContent('Colheita da soja prevista em 3 de março de 2027')
    expect(r).toHaveTextContent('Gerado em 15 de novembro de 2026 pelo Raiz Orbital')
    const titles = within(r).getAllByRole('heading', { level: 2, hidden: true }).map((heading) => heading.textContent)
    expect(titles).toEqual([
      '1. Sua terra',
      '2. Últimas safras',
      '3. Opções comparadas',
      '4. Plano de 3 anos',
      '5. O que fazer e quando',
      '6. Alertas e clima',
      '7. Fontes e aviso',
    ])
    expect(r).toHaveTextContent('2023/24Milho com braquiária')
    expect(r).toHaveTextContent('2024/25Deixei parado')
    expect(r).toHaveTextContent('2026/27 (o que você pensava plantar)Sorgo')

    const plan = within(r).getAllByRole('table', { hidden: true })[2]
    const header = within(plan).getAllByRole('columnheader', { hidden: true }).map((cell) => cell.textContent)
    // Tarefa 0065: o prazo do ZARC de cada ano (o `data_limite` do /api/plano)
    expect(header).toEqual(['Safra', '2005–2024', '2041–2060', 'Prazo', 'Prós', 'Contras'])
    const years = within(plan).getAllByRole('row', { hidden: true }).slice(1)
    expect(years).toHaveLength(3)
    expect(years.map((row) => within(row).getAllByRole('cell', { hidden: true })[3].textContent)).toEqual([
      'Até 20 de março',
      'Até 31 de março',
      'Até 20 de março',
    ])
    expect(years[1]).toHaveTextContent('Milheto')
    expect(years[1]).toHaveTextContent('Não dá grão para vender')
    expect(r).toHaveTextContent('Como o plano ajuda a ganhar:')
    expect(r).toHaveTextContent('Sorgo dá grão para vender em 2026/27 e 2028/29.')
    expect(r).toHaveTextContent('Plano B: se o outono vier seco, trocar sorgo por crotalária.')
    expect(r).toHaveTextContent('Plante sorgo')
    // A próxima soja com o prazo do 2º ano (milheto) na linha do tempo
    expect(r).toHaveTextContent('Próxima soja; depois dela, milhetoPlante até 31 de março (prazo do ZARC).')
    expect(r).toHaveTextContent('Em 20 anos, houve 6 dias com 50 mm ou mais de chuva em fevereiro e março.')
    expect(r).toHaveTextContent('Ajuda a decidir. Não substitui o seu agrônomo nem os alertas da Defesa Civil.')
  })

  it('sem resposta e sem o satélite, "não preenchido"', async () => {
    await renderPlanning(`/planejamento?${flow}&exemplo=1`)
    expect(report()).toHaveTextContent('não preenchido')
  })

  it('em inglês, as 7 seções com prós e contras', async () => {
    await renderPlanning(`/planejamento?${demo}`, planningDeps(), 'en')
    const r = report()
    expect(within(r).getAllByRole('heading', { level: 2, hidden: true }).map((heading) => heading.textContent)).toEqual([
      '1. Your soil',
      '2. Last seasons',
      '3. Options compared',
      '4. 3-year plan',
      '5. What to do and when',
      '6. Alerts and climate',
      '7. Sources and notice',
    ])
    expect(r).toHaveTextContent('Raiz Orbital · Planning report')
    expect(r).toHaveTextContent('Pros')
    expect(r).toHaveTextContent('Cons')
    expect(r).toHaveTextContent('How the plan helps you earn:')
    expect(r).toHaveTextContent('Helps you decide. It does not replace your agronomist or Civil Defense alerts.')
  })
})

describe('PlanningView: estados', () => {
  function renderState(d: ReturnType<typeof planningDeps>) {
    function Screen() {
      const { lang, messages: t } = useI18n()
      return <PlanningView t={t} lang={lang} state={usePlanningController(d)} />
    }
    render(
      <I18nProvider initialLang="pt">
        <MemoryRouter initialEntries={[`/planejamento?${flow}`]}>
          <Screen />
        </MemoryRouter>
      </I18nProvider>,
    )
  }

  it('carregando e, fora da área com dados preparados, "Ainda não chegamos aí"', async () => {
    const d = planningDeps()
    d.farm.recomendacao = vi.fn(() => Promise.reject(new ApiError('/api/recomendacao', 404, 'OUTSIDE_AREA')))
    renderState(d)
    expect(screen.getByText('Montando o seu planejamento…')).toBeInTheDocument()
    expect(await screen.findByText('Ainda não chegamos aí')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Imprimir relatório' })).not.toBeInTheDocument()
  })

  it('falha: a mensagem com "Tentar de novo"', async () => {
    const d = planningDeps()
    d.farm.recomendacao = vi.fn(() => Promise.reject(new Error('rede')))
    renderState(d)
    expect(await screen.findByText('Não deu para montar o seu planejamento agora.')).toBeInTheDocument()
  })
})
