import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { Recomendacao } from '../models/recomendacao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { buildSuggestion } from '../services/suggestionService'
import { AnswerView, type AnswerViewProps } from './AnswerView'

const params = { lat: -18.9543, lon: -48.1993, colheita: 'meio' as const }
const query = '?lat=-18.9543&lon=-48.1993&colheita=meio'
const nav = {
  label: 'Telas da resposta',
  backTo: `/quando${query}`,
  tabs: [
    { to: `/resposta${query}`, label: 'Sugestão', current: true },
    { to: `/opcoes${query}`, label: 'Comparar', current: false },
    { to: `/plano${query}`, label: 'Plano de 3 anos', current: false },
  ],
  objective: null,
  chooseObjective: vi.fn(),
}
const RAIN_END = {
  median: '2023-04-21',
  earliest: { date: '2021-03-16', year: 2021 },
  latest: { date: '2012-06-22', year: 2012 },
  firstYear: 2005,
  lastYear: 2024,
  years: 20,
  sources: ['gpm_imerg'],
  startDate: '2023-03-01',
  days: 20,
  maxMm: 10,
}

function suggestionOf(rec: Recomendacao = buildRecomendacao(params, 'pt'), objective: 'terra' | null = null) {
  return buildSuggestion(rec, objective)
}

function setup(overrides: Partial<AnswerViewProps> = {}) {
  const props: AnswerViewProps = {
    t: pt,
    lang: 'pt',
    nav,
    status: 'ready',
    onRetry: vi.fn(),
    suggestion: suggestionOf(),
    colheita: 'meio',
    aviso: 'Ajuda a decidir. Não substitui o agrônomo.',
    sampleData: false,
    telegramHref: null,
    rain: { years: 20, period: { start: '2005', end: '2024' }, skipped: 0 },
    rainEnd: RAIN_END,
    planTo: `/plano${query}`,
    year: { selected: null, choose: vi.fn(), timeline: null, timelineStatus: null },
    ...overrides,
  }
  render(
    <MemoryRouter>
      <AnswerView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('AnswerView (aba Sugestão, tarefa 0044)', () => {
  it('a melhor opção é o "Ano 1 do seu plano", com a imagem da planta e o selo de sede', () => {
    setup()

    expect(screen.getByText('Depois da soja de 2027, na sua lavoura:')).toBeInTheDocument()
    expect(screen.getByText('Ano 1 do seu plano')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Milho com braquiária' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Desenho da planta: Milho com braquiária' }).length).toBeGreaterThan(0)
    expect(screen.getByText('Sede: muita água')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Saiba mais: Milho com braquiária' })).toHaveAttribute('href', '/guia/milho-braquiaria')
  })

  it('"Se você prefere…" saiu da Sugestão: virou o ponto de partida do Comparar (tarefa 0045)', () => {
    setup()

    expect(screen.queryByRole('region', { name: 'Se você prefere…' })).not.toBeInTheDocument()
    expect(screen.queryByText('Se você prefere…')).not.toBeInTheDocument()
  })

  it('mostra os 3 anos do plano em miniatura e o link "Explorar o plano"', () => {
    setup()

    const plan = screen.getByRole('list', { name: 'Seu plano de 3 anos' })
    expect(within(plan).getAllByRole('listitem')).toHaveLength(3)
    expect(within(plan).getByText('2027')).toBeInTheDocument()
    expect(within(plan).getByText('2029')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Explorar o plano' })).toHaveAttribute('href', `/plano${query}`)
  })

  it('as linhas do cartão vêm na ordem: Deu certo, Água, Clima 2041–2060, Renda e Terra', () => {
    setup()

    const labels = [...document.querySelectorAll('[data-row-label]')].map((el) => el.textContent)
    expect(labels).toEqual(['Deu certo', 'Água', 'Clima 2041–2060', 'Renda', 'Terra'])
  })

  it('explica "deu certo" com o critério real do motor (ISNA e 3 dias de 35 °C), com o link do Guia', () => {
    setup()

    expect(screen.getByText('Deu certo em 14 de 20 anos')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Deu certo = a planta teve pelo menos 55% da água que precisa na fase que mais precisa de água (15 dias antes e depois da floração) e não fez 35 °C em 3 dias ou mais nessa fase.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Saiba mais: O que significa "deu certo"' })).toHaveAttribute('href', '/guia/deu-certo')
  })

  it('o explorador tem uma barra por ano, a linha de corte e a legenda em texto (nunca só cor)', () => {
    setup()

    const chart = screen.getByRole('group', { name: 'Água na fase que mais precisa, ano a ano. Deu certo em 14 de 20 anos.' })
    expect(within(chart).getAllByRole('button')).toHaveLength(20)
    expect(screen.getByText('Limite: 55%')).toBeInTheDocument()
    expect(screen.getByText('N: El Niño · L: La Niña (NOAA)')).toBeInTheDocument()
    expect(screen.getByText('Toque num ano para ver o que aconteceu.')).toBeInTheDocument()
    expect(within(chart).getByRole('button', { name: /^2007: \d+% da água que a planta precisa\. Faltou água\. Ano de El Niño\.$/ })).toBeInTheDocument()
  })

  it('tocar num ano avisa o controller', async () => {
    const props = setup()

    await userEvent.click(screen.getByRole('button', { name: /^2016:/ }))
    expect(props.year.choose).toHaveBeenCalledWith(2016)
  })

  it('o ano aberto mostra semeadura, floração, sequência sem chuva, calor, El Niño, SMAP, o motivo e a safra dia a dia', () => {
    const suggestion = suggestionOf()!
    const detail = suggestion.best.anos_detalhe!.find((d) => d.ano === 2016)!
    setup({
      suggestion,
      year: {
        selected: detail,
        choose: vi.fn(),
        timeline: { ano: 2016, opcao: 'milho_braquiaria', eventos: [{ data: '2016-02-18', tipo: 'semeadura', texto: 'Semeadura de teste.' }] },
        timelineStatus: 'ready',
      },
    })

    const panel = screen.getByRole('region', { name: 'O que aconteceu em 2016' })
    expect(within(panel).getByText('Semeadura').parentElement).toHaveTextContent('Semeadura18 de fevereiro')
    expect(within(panel).getByText('Floração, a fase que mais precisa de água')).toBeInTheDocument()
    expect(within(panel).getByText('Maior sequência sem chuva nessa fase')).toBeInTheDocument()
    expect(within(panel).getByText('Dias de 35 °C ou mais nessa fase')).toBeInTheDocument()
    expect(within(panel).getByText('Ano de El Niño')).toBeInTheDocument()
    expect(within(panel).getByText('40% da água que a terra guarda')).toBeInTheDocument()
    expect(within(panel).getByText(detail.texto)).toBeInTheDocument()
    expect(within(panel).getByText('Semeadura de teste.')).toBeInTheDocument()
    expect(within(panel).getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
  })

  it('sem SMAP no ano (antes de 2016), a umidade inicial não aparece', () => {
    const suggestion = suggestionOf()!
    const detail = suggestion.best.anos_detalhe!.find((d) => d.ano === 2010)!
    setup({ suggestion, year: { selected: detail, choose: vi.fn(), timeline: null, timelineStatus: 'loading' } })

    expect(screen.queryByText('Umidade da terra no dia de plantar (SMAP)')).not.toBeInTheDocument()
  })

  it('El Niño e La Niña: a frase só aparece com diferença clara, dizendo que são poucos anos', () => {
    const rec = buildRecomendacao(params, 'pt')
    const sorgoFirst = { ...rec, objetivos: { ...rec.objetivos, equilibrio: { ordem: ['sorgo', 'milho_braquiaria'] as const, plano: ['sorgo', 'sorgo', 'sorgo'] as const, nota_plano: 60 } } } as unknown as Recomendacao
    setup({ suggestion: suggestionOf(sorgoFirst) })

    expect(screen.getByText(/^Em anos de El Niño, deu certo em \d+ de \d+; nos outros anos, em \d+ de \d+\.$/)).toBeInTheDocument()
    expect(screen.getByText('São poucos anos: mostra o que aconteceu, não é previsão.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Saiba mais: El Niño e La Niña' })).toHaveAttribute('href', '/guia/el-nino-la-nina')
  })

  it('sem diferença clara, só a marcação por ano', () => {
    setup()

    expect(screen.queryByText(/Em anos de El Niño/)).not.toBeInTheDocument()
  })

  it('a linha Água mostra precisa, costuma chover e falta, a versão 2041–2060 e o link da conta de água', () => {
    setup()

    expect(screen.getByText('Precisa de 346 mm')).toBeInTheDocument()
    expect(screen.getByText('Costuma chover 400 mm')).toBeInTheDocument()
    expect(screen.getByText('Falta 116 mm em ano normal e 158 mm em ano seco')).toBeInTheDocument()
    expect(screen.getByText('Em 2041–2060, a falta em ano normal seria de 128 mm (de 118 a 141 mm, conforme o modelo). 12 mm a mais que hoje.')).toBeInTheDocument()
    expect(screen.getByText(/a terra só guarda 60 mm/)).toBeInTheDocument()
    expect(screen.getByText(/A umidade que a palhada segura, a enxurrada e a água que fica para a próxima safra estão no Guia, sem número/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Saiba mais: A conta de água da lavoura' })).toHaveAttribute('href', '/guia/conta-de-agua')
  })

  it('a linha do clima 2041–2060 tem a chuva, a máxima, quantos modelos concordam e os anos que dariam certo', () => {
    setup()

    // Tarefa 0049: o mesmo número e a mesma frase do cartão "Clima 2041–2060" do raio-X.
    expect(screen.getByText('Chuva de março a maio: -4,5%')).toBeInTheDocument()
    expect(screen.getByText('Máxima: +1,6 °C')).toBeInTheDocument()
    expect(screen.getByText('2 de 3 modelos indicam menos chuva; 3 de 3, mais calor.')).toBeInTheDocument()
    expect(screen.getByText('Daria certo em 12 de 20 anos (de 10 a 13, conforme o modelo)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Saiba mais: O clima de 2041 a 2060' })).toHaveAttribute('href', '/guia/clima-2041-2060')
  })

  it('a renda só com fatos e a terra, sem valor em reais', () => {
    setup()

    expect(screen.getByText('Dá grão para vender')).toBeInTheDocument()
    expect(screen.getByText('Risco de perder a lavoura: faltou água ou fez calor em 6 de 20 anos.')).toBeInTheDocument()
    expect(screen.getByText('Fica coberta na seca')).toBeInTheDocument()
    expect(document.body).not.toHaveTextContent('R$')
  })

  it('"Como fazer" em quatro partes, terminando no passo a passo completo do Guia', () => {
    setup()

    const how = screen.getByRole('region', { name: 'Como fazer' })
    expect(within(how).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Quando plantar',
      'Quanto tempo leva',
      'O que observar',
      'Manejo',
    ])
    expect(within(how).getByText('Logo depois de colher a soja, até 28 de fevereiro (data limite do ZARC na conta).')).toBeInTheDocument()
    expect(within(how).getByText('Cerca de 120 dias da semeadura ao fim do ciclo; floresce por volta do dia 60.')).toBeInTheDocument()
    expect(within(how).getByText('Veranico: em metade dos anos, a planta ficou 9 dias ou mais sem chuva na fase que mais precisa de água.')).toBeInTheDocument()
    expect(within(how).getByText('Calor: em nenhum dos 20 anos fez 35 °C em 3 dias ou mais nessa fase.')).toBeInTheDocument()
    expect(within(how).getByText('Fim das chuvas: em metade dos anos, a chuva acabou até 21 de abril.')).toBeInTheDocument()
    expect(within(how).getByText('Semeie o capim junto com o milho.')).toBeInTheDocument()
    expect(within(how).getByText('Rascunho: a revisar pela agrônoma.')).toBeInTheDocument()
    expect(within(how).getByRole('link', { name: 'Passo a passo completo' })).toHaveAttribute('href', '/guia/milho-braquiaria')
  })

  it('colheita tarde: um aviso só com a lista, a linha do ZARC com o link e a geada quando houve', () => {
    const late = buildRecomendacao({ ...params, colheita: 'tarde' }, 'pt')
    setup({ suggestion: suggestionOf(late), colheita: 'tarde' })

    const notice = screen.getByRole('region', { name: 'Colheita tarde' })
    expect(
      within(notice).getByText(
        'Colhendo depois de 20 de fevereiro, já passou o prazo seguro de plantio (ZARC, 28 de fevereiro) para milho sozinho. Por isso ela não aparece.',
      ),
    ).toBeInTheDocument()
    expect(within(notice).getByText(/ZARC é o Zoneamento Agrícola de Risco Climático/)).toBeInTheDocument()
    expect(within(notice).getByRole('link', { name: 'Saiba mais: O prazo de plantio e o ZARC' })).toHaveAttribute(
      'href',
      '/guia/prazo-de-plantio-zarc',
    )
    expect(within(notice).getByText('Geada: em 1 de 20 anos a mínima chegou a 3 °C ou menos entre maio e julho (NASA POWER).')).toBeInTheDocument()
  })

  it('sem nada fora da janela, nenhum aviso de colheita tarde', () => {
    setup()

    expect(screen.queryByRole('region', { name: 'Colheita tarde' })).not.toBeInTheDocument()
  })

  it('não tem mais o relatório para banco ou seguro', () => {
    setup()

    expect(screen.queryByText(/Relatório/)).not.toBeInTheDocument()
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en', suggestion: suggestionOf(buildRecomendacao(params, 'en')) })

    expect(screen.getByText('Year 1 of your plan')).toBeInTheDocument()
    expect(screen.getByText('Needs 346 mm')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'When to plant' })).toBeInTheDocument()
  })

  it('carregando, com erro ou fora da área, não mostra a sugestão', () => {
    setup({ status: 'outside', suggestion: null })

    expect(screen.queryByText('Ano 1 do seu plano')).not.toBeInTheDocument()
    expect(screen.getByText(pt.where.outsideTitle)).toBeInTheDocument()
  })

  it('com os dados de exemplo, avisa junto do aviso do agrônomo', () => {
    setup({ sampleData: true })

    expect(screen.getByText('Valores de exemplo. Ajuda a decidir. Não substitui o agrônomo.')).toBeInTheDocument()
  })
})
