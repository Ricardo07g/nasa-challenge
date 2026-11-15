import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { scoreRows } from '../services/recomendacaoRules'
import type { MetodoRegras } from '../models/metodo'
import { MethodView, type MethodViewProps } from './MethodView'

/** Regras de teste no formato do `GET /api/metodo` (números diferentes dos do regras.yaml, de propósito). */
const RULES: MetodoRegras = {
  deu_certo: { isna_grao_pct: 61, isna_cobertura_pct: 47, janela_grao_meia_dias: 12, janela_cobertura_dias: 25, calor_temp_c: 34, calor_min_dias: 2 },
  pesos: { seguranca_pct: 31, futuro_pct: 19, solo_pct: 21, renda_pct: 29 },
  renda: { tipos_com_grao: ['consorcio', 'grao'], nota_sem_grao: 5 },
  agua: { sede_pouca_ate_mm: 270, sede_muita_desde_mm: 330, percentil_seco: 25 },
  rotacao: { bonus_diversidade_2: 4, bonus_diversidade_3: 9, max_pousios: 2, culturas_supressoras_nematoide: ['crotalaria', 'milheto'] },
  plano_b: { dias_antes_semeadura: 14, anos_falha_min: 4, sensibilidade_min_pct: 55, precisao_min_pct: 65, chance_max_pct: 8 },
  alertas: {
    geada_temp_c: 2,
    geada_inicio: '05-01',
    geada_fim: '07-31',
    chuva_forte_mm: 45,
    chuva_forte_inicio: '02-01',
    chuva_forte_fim: '03-31',
    fogo_raio_km: 6,
  },
  avisos: { terra_seca_percentil_max: 18, dias_sem_chuva_min: 9, calor_dias_min: 4, calor_janela_dias: 11, vizinhos_dias: 8, raio_km: 31 },
  sinal: { estacao_previsao: 'FMA', fase_chance_min_pct: 52, anos_fase_min: 6, anos_ruins_seco_pct: 51 },
}

const rows = scoreRows(buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt'))

function setup(overrides: Partial<MethodViewProps> = {}) {
  const props: MethodViewProps = {
    t: pt,
    lang: 'pt',
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
    rules: RULES,
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
    // Tarefa 0049: o cartão "em breve" da validação saiu (só aparece o que está ligado).
    expect(screen.queryByRole('region', { name: 'Bateu com o que aconteceu?' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'O que o satélite não enxerga' })).toHaveTextContent(
      'seu pluviômetro vale mais',
    )
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/')
  })

  it('de onde vem cada dado: só as fontes ligadas de fato aparecem (decisão D2, sem "Ainda não conectado")', () => {
    setup()

    const sources = screen.getByRole('region', { name: 'De onde vem cada dado' })
    expect(within(sources).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Calor e gasto de água da lavoura (ETo), dia a dia; a chuva, só nos anos sem o GPM IMERG',
      'Tipo de terra',
    ])
    expect(sources).toHaveTextContent('NASA POWER')
    expect(sources).not.toHaveTextContent('GPM IMERG (NASA)') // o cartão do IMERG não aparece
    expect(sources).not.toHaveTextContent('NEX-GDDP-CMIP6')
    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
  })

  it('de onde vem cada dado diz a área do MVP, mesmo antes de as fontes chegarem (tarefa 0051)', () => {
    setup({ sources: { status: 'loading', rows: [], rainKm: null } })

    expect(screen.getByRole('region', { name: 'De onde vem cada dado' })).toHaveTextContent(
      'Nesta primeira versão (MVP), os dados estão prontos para a região de Uberlândia e Uberaba (MG). Vamos ampliar para todo o Triângulo Mineiro.',
    )
  })

  it('"Como a conta é feita" explica a renda sem reais: dá grão ou não, com a segurança (tarefa 0040)', () => {
    setup()

    const income = screen.getByRole('region', { name: 'Renda sem valores em reais' })
    expect(income).toHaveTextContent('A renda não usa preço nem custo.')
    expect(income).toHaveTextContent('Quem dá grão para vender ganha na renda a mesma nota da segurança')
    expect(income).toHaveTextContent('Quem não dá grão (as plantas de cobertura e a terra parada) fica com nota 5 na renda')
    expect(income).toHaveTextContent('se dá grão para vender e em quantos anos faltou água ou fez calor')
    expect(document.body).not.toHaveTextContent('R$')
  })

  it('as regras novas com os números da API, nunca fixos na tela (tarefa 0049)', () => {
    setup()

    const rules = screen.getByRole('region', { name: 'As regras da conta' })
    expect(rules).toHaveTextContent('pelo menos 61% da água que precisava')
    expect(rules).toHaveTextContent('12 dias antes e depois')
    expect(rules).toHaveTextContent('47% nos primeiros 25 dias')
    expect(rules).toHaveTextContent('não fez 34 °C em 2 dias ou mais')
    expect(rules).toHaveTextContent('segurança 31%, clima 2041–2060 19%, terra 21% e renda 29%')
    expect(rules).toHaveTextContent('quem não dá grão fica com 5')
    expect(rules).toHaveTextContent('só 25% dos anos tiveram falta maior')
    expect(rules).toHaveTextContent('pouca água abaixo de 270 mm no ciclo; muita, a partir de 330 mm')
    expect(rules).toHaveTextContent('+4 pontos para 2 funções diferentes e +9 para 3')
    expect(rules).toHaveTextContent('Quebram o ciclo do nematoide: crotalária e milheto.')
    expect(rules).toHaveTextContent('chuva dos 14 dias antes de plantar')
    expect(rules).toHaveTextContent('4 anos de falha ou mais, pegando 55% das falhas, com 65% dos anos marcados')
    expect(rules).toHaveTextContent('acaso de até 8%')
    expect(rules).toHaveTextContent('mínima de 2 °C ou menos de 1 de maio a 31 de julho')
    expect(rules).toHaveTextContent('dias com 45 mm ou mais de 1 de fevereiro a 31 de março')
    expect(rules).toHaveTextContent('fogo a até 6 km do ponto')
    expect(rules).toHaveTextContent('percentil 18 ou menos')
    expect(rules).toHaveTextContent('9 dias seguidos sem chuva ou 4 dias de 34 °C nos últimos 11')
    expect(rules).toHaveTextContent('últimos 8 dias, a até 31 km')
    expect(rules).toHaveTextContent('52% ou mais')
    expect(rules).toHaveTextContent('51% ou mais')
    expect(rules).toHaveTextContent('Raio-X')
    expect(screen.getByRole('region', { name: 'Renda sem valores em reais' })).toHaveTextContent('nota 5 na renda')
    expect(screen.queryByText(/hoje zero/)).not.toBeInTheDocument()
  })

  it('sem as regras (API antiga ou falha), o bloco das regras não aparece', () => {
    setup({ rules: null })

    expect(screen.queryByRole('region', { name: 'As regras da conta' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Renda sem valores em reais' })).toHaveTextContent('A renda não usa preço nem custo.')
  })

  it('as regras em inglês', () => {
    setup({ t: en, lang: 'en' })

    const rules = screen.getByRole('region', { name: 'The rules of the calculation' })
    expect(rules).toHaveTextContent('at least 61% of the water it needed')
    expect(rules).toHaveTextContent('from May 1 to July 31')
  })

  it('a renda em inglês', () => {
    setup({ t: en })

    const income = screen.getByRole('region', { name: 'Income without money values' })
    expect(income).toHaveTextContent('Income does not use prices or costs.')
    expect(income).toHaveTextContent('get the same income score as their safety score')
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

  it('sem o CMIP6, a nota Futuro fica "—" na tabela, sem o selo "Ainda não conectado" (decisão D2)', () => {
    setup({ rows: rows.map((row) => ({ ...row, notas: { ...row.notas, futuro: null } })) })

    expect(screen.getByRole('table', { name: 'Notas de cada opção (0 a 100)' })).toHaveTextContent('—')
    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
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
    expect(table).toHaveTextContent('Milho com braquiária7060507066')
    expect(screen.getByText('Lavoura de demonstração, perto de Uberlândia (MG).')).toBeInTheDocument()
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
    expect(screen.getByRole('region', { name: 'Where each piece of data comes from' })).toHaveTextContent(
      'This first version (MVP) has data ready for the Uberlândia and Uberaba region (Minas Gerais, Brazil). We will expand to the whole Triângulo Mineiro.',
    )
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
