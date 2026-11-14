import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { scoreRows } from '../services/recomendacaoRules'
import { MethodView, type MethodViewProps } from './MethodView'

const rows = scoreRows(buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt'))

function setup(overrides: Partial<MethodViewProps> = {}) {
  const props: MethodViewProps = {
    t: pt,
    backTo: '/',
    status: 'ready',
    onRetry: vi.fn(),
    rows,
    example: true,
    telegramHref: null,
    sources: {
      status: 'ready',
      rows: [
        { key: 'nasa_power', connected: true },
        { key: 'soilgrids', connected: true },
        { key: 'gpm_imerg', connected: false },
        { key: 'smap', connected: false },
        { key: 'modis', connected: false },
        { key: 'nex_gddp_cmip6', connected: false },
      ],
      rainKm: 50,
    },
    onRetrySources: vi.fn(),
    rain: { years: 20, period: { start: '2005', end: '2024' }, skipped: 0 },
    ...overrides,
  }
  render(
    <MemoryRouter>
      <MethodView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('MethodView (tela 9)', () => {
  it('o método em três passos, a conta aberta, a validação e o que o satélite não enxerga', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Como a conta é feita' })).toBeInTheDocument()
    expect(screen.getByText('Em três passos, e o que o satélite não enxerga.')).toBeInTheDocument()
    expect(screen.getByText(/Pegamos a chuva e o calor de cada ano/)).toBeInTheDocument()
    expect(screen.getByText(/Contamos em quantos anos faltou água/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Sem inteligência artificial, conta aberta' })).toHaveTextContent(
      'Embrapa e do ZARC',
    )
    expect(screen.getByRole('region', { name: 'Bateu com o que aconteceu?' })).toHaveTextContent('IBGE')
    expect(screen.getByRole('region', { name: 'O que o satélite não enxerga' })).toHaveTextContent(
      'seu pluviômetro vale mais',
    )
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/')
  })

  it('de onde vem cada dado: as 6 fontes, com as que ainda não estão conectadas marcadas', () => {
    setup()

    const sources = screen.getByRole('region', { name: 'De onde vem cada dado' })
    expect(within(sources).getAllByRole('heading', { level: 3 })).toHaveLength(6)
    const card = (what: string) => within(sources).getByRole('heading', { name: what }).closest('[data-status]')
    expect(card('Chuva e calor, dia a dia')).toHaveAttribute('data-status', 'ready')
    expect(card('Chuva e calor, dia a dia')).toHaveTextContent('NASA POWER')
    expect(card('Tipo de terra')).toHaveAttribute('data-status', 'ready')
    expect(card('Chuva mais detalhada')).toHaveTextContent('GPM IMERG (NASA)quadrados de 10 km, por diaAinda não conectado')
    expect(card('Umidade da terra')).toHaveTextContent('Ainda não conectado')
    expect(card('Histórico do talhão')).toHaveTextContent('Ainda não conectado')
    expect(card('Clima de 2041 a 2060')).toHaveTextContent('NEX-GDDP-CMIP6 (NASA)')
    expect(card('Clima de 2041 a 2060')).toHaveAttribute('data-status', 'unavailable')
    expect(within(sources).getAllByText('Ainda não conectado')).toHaveLength(4)
  })

  it('o passo 1 diz o período da chuva que veio da API, e o que o satélite não enxerga diz o tamanho real do quadrado', () => {
    setup()

    expect(screen.getByText('Pegamos a chuva e o calor de cada ano (20 anos entre 2005 e 2024), no ponto do seu talhão.')).toBeInTheDocument()
    const blind = screen.getByRole('region', { name: 'O que o satélite não enxerga' })
    expect(blind).toHaveTextContent('A chuva vem em quadrados de cerca de 50 km')
    expect(blind).toHaveTextContent('O clima de 2041 a 2060 é uma faixa entre modelos')
    expect(blind).not.toHaveTextContent('10 km')
    expect(blind).not.toHaveTextContent('2050')
  })

  it('sem o talhão ainda, o passo 1 e o tamanho da chuva não inventam números', () => {
    setup({ rain: null, sources: { status: 'loading', rows: [], rainKm: null } })

    expect(screen.getByText('Pegamos a chuva e o calor de cada ano no ponto do seu talhão.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'O que o satélite não enxerga' })).toHaveTextContent(
      'A chuva vem de quadrados de vários quilômetros',
    )
    expect(screen.getByRole('region', { name: 'De onde vem cada dado' })).toHaveTextContent('Carregando…')
  })

  it('se as fontes não vierem, dá para tentar de novo', async () => {
    const props = setup({ sources: { status: 'error', rows: [], rainKm: null } })

    const sources = screen.getByRole('region', { name: 'De onde vem cada dado' })
    await userEvent.click(within(sources).getByRole('button', { name: 'Tentar de novo' }))
    expect(props.onRetrySources).toHaveBeenCalled()
  })

  it('sem o CMIP6, a nota Futuro fica "—" na tabela e a nota é marcada como "Ainda não conectado"', () => {
    setup({ rows: rows.map((row) => ({ ...row, notas: { ...row.notas, futuro: null } })) })

    const note = screen
      .getAllByText('Ainda não conectado')
      .map((text) => text.closest('[data-status="not-connected"]'))
      .find((element) => element?.textContent?.startsWith('Futuro'))
    expect(note).toHaveTextContent('Futuro: Ainda não conectado')
  })

  it('a tabela com as notas de 0 a 100 (só nesta tela) e de qual fazenda elas são', () => {
    setup()

    const table = screen.getByRole('table', { name: 'Notas de cada opção (0 a 100)' })
    expect(within(table).getAllByRole('row')).toHaveLength(rows.length + 1)
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Opção',
      'Segurança',
      'Futuro',
      'Terra',
      'Renda',
      'Final',
    ])
    expect(table).toHaveTextContent('Milho com braquiária7060507466')
    expect(screen.getByText('Fazenda de exemplo: área experimental da UFU, Uberlândia (MG).')).toBeInTheDocument()
  })

  it('com a lavoura da pessoa, não diz que é a fazenda de exemplo', () => {
    setup({ example: false })

    expect(screen.queryByText(/Fazenda de exemplo/)).not.toBeInTheDocument()
  })

  it('enquanto as notas carregam, o resto da tela já aparece', () => {
    setup({ status: 'loading', rows: [] })

    expect(screen.getByRole('heading', { level: 1, name: 'Como a conta é feita' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
  })

  it('se as notas não vierem, dá para tentar de novo', async () => {
    const props = setup({ status: 'error', rows: [] })

    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(props.onRetry).toHaveBeenCalled()
  })

  it('em inglês', () => {
    setup({ t: en })

    expect(screen.getByRole('table', { name: 'Scores for each option (0 to 100)' })).toBeInTheDocument()
  })

  it('com o bot configurado, explica como usar pelo Telegram (P5)', () => {
    setup({ telegramHref: 'https://t.me/BotDoTime' })

    const section = screen.getByRole('region', { name: 'Também no Telegram' })
    expect(section).toHaveTextContent('Mande a localização da lavoura e diga quando colhe a soja.')
    expect(screen.getByRole('link', { name: 'Abrir no Telegram' })).toHaveAttribute('href', 'https://t.me/BotDoTime')
  })

  it('sem o bot configurado, não fala do Telegram', () => {
    setup()

    expect(screen.queryByText(/Telegram/)).not.toBeInTheDocument()
  })
})
