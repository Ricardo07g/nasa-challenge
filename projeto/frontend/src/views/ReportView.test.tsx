import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { buildRecomendacao, buildTalhao } from '../repositories/mocks/fixtures'
import { ReportView, type ReportViewProps } from './ReportView'

const point = { lat: -18.9543, lon: -48.1993 }

function setup(overrides: Partial<ReportViewProps> = {}) {
  const props: ReportViewProps = {
    t: pt,
    lang: 'pt',
    status: 'ready',
    onRetry: vi.fn(),
    backTo: '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio',
    talhao: buildTalhao(point, 'pt'),
    recomendacao: buildRecomendacao({ ...point, colheita: 'meio' }, 'pt'),
    example: true,
    place: 'Uberlândia (MG)',
    today: '2026-11-14',
    onPrint: vi.fn(),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <ReportView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('ReportView (relatório para banco e seguro, P2)', () => {
  it('folha com o local, a data, a opção recomendada e a semeadura', () => {
    setup()

    const sheet = screen.getByRole('article', { name: 'Relatório da lavoura · Raiz Orbital' })
    expect(within(sheet).getByRole('heading', { level: 1, name: 'Relatório da lavoura · Raiz Orbital' })).toBeInTheDocument()
    expect(sheet).toHaveTextContent('1. Local e data')
    expect(sheet).toHaveTextContent('Fazenda de exemplo: área experimental da UFU, Uberlândia (MG).')
    expect(sheet).toHaveTextContent('Coordenadas: -18.9543, -48.1993')
    expect(sheet).toHaveTextContent('Data de hoje: 14 de novembro de 2026')
    expect(sheet).toHaveTextContent('Versão dos dados: 2026-11-14T13:00Z')
    expect(sheet).toHaveTextContent('Milho com braquiária')
    expect(sheet).toHaveTextContent('Semeadura em 18 de fevereiro de 2027 · dentro da janela de plantio')
  })

  it('tabela com todas as opções', () => {
    setup()

    const table = screen.getByRole('table', { name: 'Todas as opções' })
    expect(within(table).getAllByRole('row')).toHaveLength(6)
    expect(table).toHaveTextContent('Milho com braquiária14 de 2012 de 20 (de 10 a 13)R$ 700Fica coberta na seca')
    expect(within(table).getByRole('columnheader', { name: 'Anos que deram certo' })).toBeInTheDocument()
    expect(table).not.toHaveTextContent('(de 20)')
  })

  it('a tabela traz o clima de 2041–2060 de cada opção, com a faixa entre os modelos', () => {
    const rec = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')
    const futuro = { anos_bons_media: 19, anos_bons_min: 19, anos_bons_max: 19, modelos: 3, cenario: 'ssp245' }
    setup({ recomendacao: { ...rec, opcoes: rec.opcoes.map((o) => (o.id === 'sorgo' ? { ...o, futuro } : o)) } })

    const table = screen.getByRole('table', { name: 'Todas as opções' })
    const headers = within(table).getAllByRole('columnheader').map((header) => header.textContent)
    expect(headers).toEqual(['Opção', 'Anos que deram certo', 'Clima 2041–2060', 'Sobra por hectare', 'Terra'])
    expect(within(table).getByRole('row', { name: /Sorgo/ })).toHaveTextContent('Sorgo17 de 2019 de 20R$')
  })

  it('sem o dado do CMIP6, a coluna do futuro fica com "Ainda não conectado"', () => {
    const rec = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')
    setup({ recomendacao: { ...rec, opcoes: rec.opcoes.map((option) => ({ ...option, futuro: null })) } })

    const row = within(screen.getByRole('table', { name: 'Todas as opções' })).getByRole('row', { name: /Sorgo/ })
    expect(row.querySelector('[data-status="not-connected"]')).toHaveTextContent('Ainda não conectado')
  })

  it('opção fora da janela: o aviso ocupa as colunas de anos e de clima futuro', () => {
    const rec = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')
    setup({ recomendacao: { ...rec, opcoes: rec.opcoes.map((o) => (o.id === 'sorgo' ? { ...o, na_janela: false } : o)) } })

    const row = within(screen.getByRole('table', { name: 'Todas as opções' })).getByRole('row', { name: /Sorgo/ })
    const cell = within(row).getByText('Fora da janela de plantio')
    expect(cell).toHaveAttribute('colspan', '2')
    expect(row).not.toHaveTextContent('de 20')
  })

  it('sinal do outono, histórico da área e fontes', () => {
    setup()

    const sheet = screen.getByRole('article')
    expect(sheet).toHaveTextContent('Sinal para o outono de 2027')
    expect(sheet).toHaveTextContent('Sem sinal claro')
    expect(sheet).toHaveTextContent('Chance de El Niño e La Niña publicada por NOAA em 12 de novembro.')
    expect(sheet).toHaveTextContent('Ficou parada em 5 de 9 anos (1 sem certeza)')
    expect(sheet).toHaveTextContent('GPM IMERG · NASA POWER · NEX-GDDP-CMIP6 · MODIS · SoilGrids · NOAA · SMAP')
    expect(sheet).toHaveTextContent('Não é laudo técnico, não substitui o ZARC oficial nem o agrônomo responsável.')
  })

  it('histórico da área: o ano sem certeza fica cinza com "?" e a fonte vem embaixo da faixa', () => {
    setup()

    const strip = screen.getByRole('img', { name: 'Ficou parada em 5 de 9 anos (1 sem certeza)' })
    expect(strip.querySelectorAll('[data-state="unknown"]')).toHaveLength(1)
    expect(strip.querySelector('[data-state="unknown"]')).toHaveTextContent('?')
    expect(screen.getByRole('article')).toHaveTextContent('Visto pelo satélite MODIS (NASA), de abril a julho de cada ano')
  })

  it('sem sinal e sem histórico na API, as seções ficam com "Ainda não conectado" (não somem)', () => {
    const rec = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')
    setup({ recomendacao: { ...rec, sinal: undefined }, talhao: { ...buildTalhao(point, 'pt'), historico: null } })

    const sheet = screen.getByRole('article')
    expect(sheet).toHaveTextContent('4. Sinal para o outono de 2027Ainda não conectado')
    expect(sheet).toHaveTextContent('5. Histórico da áreaAinda não conectado')
    expect(sheet).toHaveTextContent('6. Fontes')
    expect(sheet).not.toHaveTextContent('Sem sinal claro')
  })

  it('outra lavoura mostra o lugar aproximado, não a fazenda de exemplo', () => {
    setup({ example: false })

    expect(screen.getByRole('article')).toHaveTextContent('Perto de Uberlândia (MG)')
  })

  it('"Salvar em PDF" abre a impressão; Voltar leva à resposta', async () => {
    const props = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Salvar em PDF' }))
    expect(props.onPrint).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute(
      'href',
      '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
  })

  it('enquanto carrega e fora da área', () => {
    const { unmount } = render(
      <MemoryRouter>
        <ReportView {...({ t: pt, lang: 'pt', status: 'loading', backTo: '/' } as unknown as ReportViewProps)} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    unmount()

    setup({ status: 'outside', talhao: null, recomendacao: null })
    expect(screen.getByRole('region', { name: 'Ainda não chegamos aí' })).toBeInTheDocument()
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en', recomendacao: buildRecomendacao({ ...point, colheita: 'meio' }, 'en') })

    expect(screen.getByRole('heading', { level: 1, name: 'Field report · Raiz Orbital' })).toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveTextContent('Left idle in 5 of 9 years (1 uncertain)')
    expect(screen.getByRole('article')).toHaveTextContent('Seen by the MODIS satellite (NASA), from April to July each year')
    const table = screen.getByRole('table', { name: 'All options' })
    expect(within(table).getByRole('columnheader', { name: '2041–2060 climate' })).toBeInTheDocument()
    expect(table).toHaveTextContent('Corn with brachiaria14 of 2012 of 20 (10 to 13)')
  })
})
