import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { buildRaioX } from '../repositories/mocks/raioXFixture'
import { alertList, heatmap, xRayBlocks } from '../services/raioXService'
import { SatelliteView, type SatelliteViewProps } from './SatelliteView'

function setup(overrides: Partial<SatelliteViewProps> = {}) {
  const props: SatelliteViewProps = {
    t: pt,
    lang: 'pt',
    backTo: '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
    status: 'ready',
    onRetry: vi.fn(),
    history: {
      idle: 1,
      planted: 1,
      uncertain: 0,
      noSoy: 0,
      confirmed: 0,
      known: 2,
      total: 2,
      situations: ['parado', 'plantou'],
      years: ['2024', '2025'],
      window: { from: 4, to: 7 },
    },
    confirmations: [],
    onConfirmSeason: vi.fn(),
    noSoy: false,
    adjustTo: '/onde?lat=-18.9543&lon=-48.1993&colheita=meio',
    rain: { years: 20, period: { start: '2005', end: '2024' }, skipped: 0 },
    climate: { period: { start: '2041', end: '2060' } },
    soil: { textura: 'argiloso', source: 'map' },
    soilOpen: false,
    onToggleSoil: vi.fn(),
    onChooseSoil: vi.fn(),
    onConfirm: vi.fn(),
    xray: null,
    heatmap: null,
    alerts: [],
    cards: null,
    answerTo: '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio',
    ...overrides,
  } as SatelliteViewProps
  render(
    <MemoryRouter>
      <SatelliteView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('SatelliteView (tela 4)', () => {
  it('sem o raio-X: histórico (sem ✓) e os 3 cartões de antes, cada um com o ✓ de pronto', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Pronto. O satélite já viu o resto.' })).toBeInTheDocument()
    expect(screen.getByText('Você não precisa preencher mais nada.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Na entressafra, sua área ficou parada em 1 de 2 anos.' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Plantou em 1 de 2 anos' })).toHaveTextContent('20242025')
    expect(screen.getByText('Ficou parado')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '20 anos de chuva daqui' })).toBeInTheDocument()
    expect(screen.getByText('De 2005 a 2024, dia por dia.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Terra argilosa' })).toBeInTheDocument()
    expect(screen.getByText('Do mapa de solos.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Clima dos próximos anos' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Pronto' })).toHaveLength(3)
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute(
      'href',
      '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
  })

  const withUncertain: SatelliteViewProps['history'] = {
    idle: 5,
    planted: 4,
    uncertain: 1,
    noSoy: 0,
    confirmed: 0,
    known: 9,
    total: 10,
    situations: ['parado', 'plantou', 'parado', 'plantou', 'parado', 'incerto', 'plantou', 'parado', 'parado', 'plantou'],
    years: ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'],
    window: { from: 4, to: 7 },
  }

  it('com ano sem certeza, a frase conta só os anos certos e o ano fica cinza com "?"', () => {
    setup({ history: withUncertain })

    expect(screen.getByRole('heading', { name: 'Na entressafra, sua área ficou parada em 5 de 10 anos.' })).toBeInTheDocument()
    const strip = screen.getByRole('img', { name: 'Plantou em 4 de 9 anos (1 sem certeza)' })
    expect(strip.querySelectorAll('[data-state="unknown"]')).toHaveLength(1)
    expect(strip.querySelector('[data-state="unknown"]')).toHaveTextContent('?')
    expect(strip.querySelectorAll('[data-state="good"]')).toHaveLength(4)
    expect(strip.querySelectorAll('[data-state="bad"]')).toHaveLength(5)
    expect(screen.getByText('Sem certeza')).toBeInTheDocument()
  })

  it('"sem_dado" também vira o quadrinho cinza com "?"', () => {
    setup({ history: { ...withUncertain, situations: [...withUncertain!.situations.slice(0, 5), 'sem_dado', ...withUncertain!.situations.slice(6)] } })

    const strip = screen.getByRole('img', { name: 'Plantou em 4 de 9 anos (1 sem certeza)' })
    expect(strip.querySelector('[data-state="unknown"]')).toHaveTextContent('?')
  })

  it('sem ano sem certeza, a frase fica sem o parêntese e a legenda sem o cinza', () => {
    setup()

    expect(screen.getByRole('heading', { name: 'Na entressafra, sua área ficou parada em 1 de 2 anos.' })).toBeInTheDocument()
    expect(screen.queryByText('Sem certeza')).not.toBeInTheDocument()
  })

  it('embaixo da faixa, diz de onde veio: o satélite MODIS e os meses olhados', () => {
    setup({ history: withUncertain })

    expect(screen.getByText('Visto pelo satélite MODIS (NASA), de abril a julho de cada ano')).toBeInTheDocument()
  })

  it('os meses da linha da fonte seguem a janela do dado', () => {
    setup({ history: { ...withUncertain!, window: { from: 5, to: 8 } } })

    expect(screen.getByText('Visto pelo satélite MODIS (NASA), de maio a agosto de cada ano')).toBeInTheDocument()
  })

  it('17 anos de chuva: o número vem do dado e o subtítulo diz quantos anos ficaram de fora', () => {
    setup({ rain: { years: 17, period: { start: '2005', end: '2024' }, skipped: 3 } })

    expect(screen.getByRole('heading', { name: '17 anos de chuva daqui' })).toBeInTheDocument()
    expect(screen.getByText('De 2005 a 2024, dia por dia. 3 anos ficaram de fora por falta de dado.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '20 anos de chuva daqui' })).not.toBeInTheDocument()
  })

  it('um ano de fora fica no singular', () => {
    setup({ rain: { years: 19, period: { start: '2005', end: '2024' }, skipped: 1 } })

    expect(screen.getByText('De 2005 a 2024, dia por dia. 1 ano ficou de fora por falta de dado.')).toBeInTheDocument()
  })

  it('com o número de anos mas sem o período, não inventa as datas', () => {
    setup({ rain: { years: 17, period: null, skipped: 0 } })

    expect(screen.getByRole('heading', { name: '17 anos de chuva daqui' })).toBeInTheDocument()
    expect(screen.getByText('Dia por dia.')).toBeInTheDocument()
  })

  it('sem dado de chuva, o cartão da chuva não aparece (decisão D2, nada de "Ainda não conectado")', () => {
    setup({ rain: null })

    expect(screen.queryByRole('heading', { name: 'Chuva daqui' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Pronto' })).toHaveLength(2)
  })

  it('com o CMIP6, o clima dos próximos anos aparece pronto, com o período do dado', () => {
    setup()

    const title = screen.getByRole('heading', { name: 'Clima dos próximos anos' })
    expect(screen.getByText('Como a chuva e o calor devem mudar de 2041 a 2060.')).toBeInTheDocument()
    expect(title.closest('[data-status]')).toHaveAttribute('data-status', 'ready')
  })

  it('com o CMIP6 mas sem o período, não inventa o ano', () => {
    setup({ climate: { period: null } })

    expect(screen.getByText('Como a chuva e o calor devem mudar nos próximos anos.')).toBeInTheDocument()
  })

  it('sem o CMIP6, o cartão do clima dos próximos anos não aparece (decisão D2)', () => {
    setup({ climate: null })

    expect(screen.queryByRole('heading', { name: 'Clima dos próximos anos' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Como a chuva e o calor devem mudar/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Pronto' })).toHaveLength(2)
  })

  it('sem histórico do satélite e sem anos para confirmar, o cartão do histórico não aparece (decisão D2)', () => {
    setup({ history: null })

    expect(screen.queryByRole('heading', { name: /ficou parada/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'O que cresceu depois da soja' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Plantou em/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Pronto' })).toHaveLength(3)
  })

  describe('confirmação das últimas safras (tarefa 0039)', () => {
    const rows: SatelliteViewProps['confirmations'] = [
      { year: 2024, satellite: 'parado', choice: null },
      { year: 2025, satellite: 'plantou', choice: 'parado' },
      { year: 2026, satellite: null, choice: null },
    ]

    it('um grupo por ano, com o que o satélite viu e "Plantei" / "Deixei parado"', () => {
      setup({ confirmations: rows })

      expect(screen.getByRole('heading', { name: 'Confirme as últimas safras' })).toBeInTheDocument()
      for (const year of [2024, 2025, 2026]) {
        const group = screen.getByRole('group', { name: `Depois da soja de ${year}` })
        expect(within(group).getByRole('button', { name: 'Plantei' })).toBeInTheDocument()
        expect(within(group).getByRole('button', { name: 'Deixei parado' })).toBeInTheDocument()
      }
      expect(screen.getByText('O satélite viu: ficou parado')).toBeInTheDocument()
      expect(screen.getByText('O satélite viu: plantou')).toBeInTheDocument()
      // 2026 sem dado do satélite: começa vazio
      expect(screen.getAllByText(/O satélite viu/)).toHaveLength(2)
      const marked = within(screen.getByRole('group', { name: 'Depois da soja de 2025' }))
      expect(marked.getByRole('button', { name: 'Deixei parado' })).toHaveAttribute('aria-pressed', 'true')
      expect(marked.getByRole('button', { name: 'Plantei' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('marcar chama o controller; tocar de novo na resposta marcada tira a confirmação', async () => {
      const props = setup({ confirmations: rows })

      await userEvent.click(within(screen.getByRole('group', { name: 'Depois da soja de 2024' })).getByRole('button', { name: 'Plantei' }))
      await userEvent.click(
        within(screen.getByRole('group', { name: 'Depois da soja de 2025' })).getByRole('button', { name: 'Deixei parado' }),
      )

      expect(props.onConfirmSeason).toHaveBeenNthCalledWith(1, 2024, 'plantou')
      expect(props.onConfirmSeason).toHaveBeenNthCalledWith(2, 2025, null)
    })

    it('sem histórico do satélite, o produtor confirma direto, sem "Ainda não conectado" (decisão D2)', () => {
      setup({ history: null, confirmations: rows.map((row) => ({ ...row, satellite: null })) })

      expect(screen.getByRole('heading', { name: 'Confirme as últimas safras' })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Depois da soja de 2026' })).toBeInTheDocument()
      expect(screen.queryByText(/O satélite viu/)).not.toBeInTheDocument()
      expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
    })

    it('sem anos para confirmar (API antiga), o bloco não aparece', () => {
      setup()

      expect(screen.queryByRole('heading', { name: 'Confirme as últimas safras' })).not.toBeInTheDocument()
    })

    it('com anos confirmados, a legenda diz quantos foram', () => {
      setup({ history: { ...withUncertain!, confirmed: 2 } })

      expect(screen.getByText('2 anos confirmados por você')).toBeInTheDocument()
    })

    it('depois de confirmar, oferece "Compartilhar com a comunidade" no bloco (tarefa 0047)', async () => {
      const onToggle = vi.fn()
      setup({
        confirmations: rows,
        share: {
          state: { open: false, showNotice: true, rows: [] },
          communityTo: '/comunidade?lat=-18.9543&lon=-48.1993&colheita=meio',
          onToggle,
          onChange: vi.fn(),
          onSend: vi.fn(),
        },
      })

      await userEvent.click(screen.getByRole('button', { name: 'Compartilhar com a comunidade' }))
      expect(onToggle).toHaveBeenCalled()
    })

    it('sem safra confirmada (ou na lavoura de demonstração), não oferece compartilhar', () => {
      setup({ confirmations: rows, share: null })

      expect(screen.queryByRole('button', { name: 'Compartilhar com a comunidade' })).not.toBeInTheDocument()
    })
  })

  describe('soja de cada ano (tarefa 0039)', () => {
    it('ano sem soja: traço na faixa e legenda própria "Sem soja"', () => {
      const situations = [...withUncertain!.situations]
      situations[2] = 'sem_soja'
      setup({ history: { ...withUncertain!, idle: 4, known: 8, noSoy: 1, situations } })

      const strip = screen.getByRole('img', { name: 'Plantou em 4 de 8 anos (1 sem certeza)' })
      expect(strip.querySelector('[data-state="none"]')).toHaveTextContent('–')
      expect(screen.getByText('Sem soja')).toBeInTheDocument()
    })

    it('sem ano sem soja, a legenda não fala de soja', () => {
      setup()

      expect(screen.queryByText('Sem soja')).not.toBeInTheDocument()
    })

    it('nenhum ano com soja: o cartão diz que não parece lavoura de soja e oferece ajustar no mapa', () => {
      setup({ history: null, noSoy: true })

      expect(
        screen.getByRole('heading', { name: 'Não parece uma lavoura de soja. Confira o ponto no mapa.' }),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Ajustar no mapa' })).toHaveAttribute(
        'href',
        '/onde?lat=-18.9543&lon=-48.1993&colheita=meio',
      )
      expect(screen.queryByText('Ainda não conectado')).not.toBeInTheDocument()
    })

    it('com safras confirmadas num ponto sem soja, o aviso continua no cartão', () => {
      setup({ noSoy: true })

      expect(screen.getByRole('heading', { name: 'Na entressafra, sua área ficou parada em 1 de 2 anos.' })).toBeInTheDocument()
      expect(screen.getByText('Não parece uma lavoura de soja. Confira o ponto no mapa.')).toBeInTheDocument()
    })
  })

  it('confirmação e soja em inglês', () => {
    setup({
      t: en,
      lang: 'en',
      history: null,
      noSoy: true,
      confirmations: [{ year: 2024, satellite: 'sem_soja', choice: null }],
    })

    expect(screen.getByRole('heading', { name: "This doesn't look like a soybean field. Check the point on the map." })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Confirm your last seasons' })).toBeInTheDocument()
    const group = screen.getByRole('group', { name: 'After the 2024 soybeans' })
    expect(within(group).getByRole('button', { name: 'I planted' })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: 'I left it idle' })).toBeInTheDocument()
    expect(screen.getByText('Satellite saw: no soybeans')).toBeInTheDocument()
  })

  it('"Não é? Trocar" chama o controller', async () => {
    const props = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Não é? Trocar' }))

    expect(props.onToggleSoil).toHaveBeenCalled()
  })

  it('com a escolha aberta, mostra as 3 terras com a atual marcada', async () => {
    const props = setup({ soilOpen: true })

    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveAttribute('aria-expanded', 'true')
    const group = screen.getByRole('group', { name: 'Qual é a sua terra?' })
    expect(group.querySelectorAll('button')).toHaveLength(3)
    expect(screen.getByRole('button', { name: /Argilosa/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: /Arenosa/ }))

    expect(props.onChooseSoil).toHaveBeenCalledWith('arenoso')
  })

  it('diz de onde veio a terra', () => {
    setup({ soil: { textura: 'arenoso', source: 'user' } })
    expect(screen.getByText('Você escolheu.')).toBeInTheDocument()
  })

  it('"Ver o que plantar" segue para a resposta', async () => {
    const props = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Ver o que plantar' }))

    expect(props.onConfirm).toHaveBeenCalled()
  })

  it('enquanto carrega, avisa e mostra os cartões vazios (nunca tela branca)', () => {
    setup({ status: 'loading' })

    expect(screen.getByRole('status')).toHaveTextContent('Buscando dados do satélite…')
    expect(screen.queryByRole('button', { name: 'Ver o que plantar' })).not.toBeInTheDocument()
  })

  it('se não vier, explica, tenta de novo ou abre o exemplo', async () => {
    const props = setup({ status: 'error' })

    expect(screen.getByRole('alert')).toHaveTextContent('Não conseguimos buscar os dados agora.')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(props.onRetry).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Ver a lavoura de demonstração' })).toHaveAttribute('href', '/exemplo')
  })

  it('em inglês', () => {
    setup({ t: en })

    expect(screen.getByRole('heading', { level: 1, name: 'Done. The satellite saw the rest.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Clayey soil' })).toBeInTheDocument()
  })

  it('o histórico em inglês, com o ano sem certeza e a linha da fonte', () => {
    setup({ t: en, lang: 'en', history: withUncertain })

    expect(screen.getByRole('heading', { name: 'In the off-season, your field was left idle in 5 of 10 years.' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Planted in 4 of 9 years (1 uncertain)' })).toBeInTheDocument()
    expect(screen.getByText('Uncertain')).toBeInTheDocument()
    expect(screen.getByText('Seen by the MODIS satellite (NASA), from April to July each year')).toBeInTheDocument()
  })

  it('chuva, clima e histórico em inglês: 17 anos, sem o CMIP6 e sem o histórico', () => {
    setup({ t: en, rain: { years: 17, period: { start: '2005', end: '2024' }, skipped: 3 }, climate: null, history: null })

    expect(screen.getByRole('heading', { name: '17 years of rain right here' })).toBeInTheDocument()
    expect(screen.getByText('From 2005 to 2024, day by day. 3 years were left out for missing data.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Climate in the coming years' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'What grew after soybeans' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Not connected yet/)).not.toBeInTheDocument()
  })

  it('fora da área com dados preparados: explica e oferece a lavoura de demonstração', () => {
    setup({ status: 'outside' })

    const outside = screen.getByRole('region', { name: 'Ainda não chegamos aí' })
    expect(outside).toHaveTextContent(
      'Por enquanto, os dados estão prontos só para a região de Uberlândia e Uberaba. Vamos ampliar para todo o Triângulo Mineiro.',
    )
    expect(screen.getByRole('link', { name: 'Ver a lavoura de demonstração' })).toHaveAttribute('href', '/exemplo')
  })
})

describe('raio-X da sua terra (tarefa 0043)', () => {
  const raio = buildRaioX({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')
  const xray = { raio, blocks: xRayBlocks(raio), place: 'Uberlândia (MG)', point: { lat: -18.9543, lon: -48.1993 } }
  const historico = {
    anos: raio.historico_ndvi!.anos.map((row, index) => ({
      ano: row.ano,
      situacao: (index % 2 ? 'plantou' : 'parado') as 'plantou' | 'parado',
      ndvi_max: 0.5,
      n_obs: 5,
      fonte_ano: (row.ano === 2025 ? 'produtor' : 'satelite') as 'produtor' | 'satelite',
    })),
    parado: 5,
    plantou: 5,
    sem_certeza: 0,
    total: 10,
    fonte: 'MODIS',
    janela: '04-01 a 07-31',
  }
  const tenYears: SatelliteViewProps['history'] = {
    idle: 5,
    planted: 5,
    uncertain: 0,
    noSoy: 0,
    confirmed: 1,
    known: 10,
    total: 10,
    situations: historico.anos.map((ano) => ano.situacao),
    years: historico.anos.map((ano) => String(ano.ano)),
    window: { from: 4, to: 7 },
  }
  const full: Partial<SatelliteViewProps> = {
    xray,
    heatmap: heatmap(raio.historico_ndvi, historico),
    alerts: alertList(raio),
    cards: raio.cartoes,
    history: tenYears,
  }

  it('painel escuro com o lugar, as coordenadas, a leitura mais recente e o mapa', () => {
    setup(full)

    const panel = screen.getByRole('region', { name: 'Raio-X da sua terra' })
    expect(within(panel).getByText('Perto de Uberlândia (MG)')).toBeInTheDocument()
    expect(within(panel).getByText('Ponto marcado: -18.9543, -48.1993')).toBeInTheDocument()
    expect(within(panel).getByText('Leitura mais recente: 10 de novembro de 2026')).toBeInTheDocument()
    expect(within(panel).getByRole('img', { name: 'Miniatura do mapa com o ponto marcado, perto de Uberlândia (MG)' })).toBeInTheDocument()
    expect(within(panel).queryByText(/Altitude/)).not.toBeInTheDocument()
    expect(
      within(panel).getByText(
        'Cada dado vale para a área em volta do ponto, no tamanho indicado em cada selo, e não para o talhão exato.',
      ),
    ).toBeInTheDocument()
  })

  it('os 8 blocos, cada um com o selo da fonte e da resolução', () => {
    setup(full)

    const panel = screen.getByRole('region', { name: 'Raio-X da sua terra' })
    const labels = within(panel).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(labels).toEqual([
      'Solo',
      'Água que a terra guarda',
      'Umidade da terra agora',
      'Verde da lavoura',
      'Chuva de um ano típico',
      'Maior veranico',
      'Calor',
      'Sua área e a região',
    ])
    expect(within(panel).getByText('SMAP · NASA · 9 km')).toBeInTheDocument()
    expect(within(panel).getByText('SoilGrids · ISRIC · 250 m')).toBeInTheDocument()
    expect(within(panel).getByText('NASA POWER · ~50 km')).toBeInTheDocument()
  })

  it('sem soja no ponto, o pico vira "maior verde de jan–mar" (tarefa 0049)', () => {
    const city = { ...raio, verde: { ...raio.verde!, pico_ndvi: 0.33, soja_vista: false } }
    setup({ ...full, xray: { ...xray, raio: city, blocks: xRayBlocks(city) } })

    expect(screen.getByText(/Maior verde de janeiro a meados de março \(2025\/26\): 0,33, em 17 de janeiro de 2026\. O satélite não viu soja aqui\./)).toBeInTheDocument()
    expect(screen.queryByText(/Pico da soja/)).not.toBeInTheDocument()
  })

  it('as frases dos blocos, com a fonte certa e os números do backend', () => {
    setup(full)

    expect(screen.getByRole('img', { name: 'Argila 32%, silte 20% e areia 48%' })).toBeInTheDocument()
    expect(screen.getByText(/Terra média, pelo mapa de solos\./)).toBeInTheDocument()
    expect(
      screen.getByText(/Aguenta cerca de 11 dias sem chuva na floração de milho com braquiária, por volta de 19 de abril\./),
    ).toBeInTheDocument()
    expect(screen.getByText('Mais úmida que em 41% dos anos nesta época. Leitura de 10 de novembro de 2026.')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: /mais úmida que em 41%/ })).toHaveAttribute('aria-valuenow', '41')
    expect(screen.getByText(/Pico da soja 2025\/26: 0,88, em 17 de janeiro de 2026\./)).toBeInTheDocument()
    expect(
      screen.getByText(/Em metade dos anos, a chuva acabou até 18 de abril; o mais cedo foi 20 de março de 2016 e o mais tarde 25 de maio de 2009\./),
    ).toBeInTheDocument()
    expect(screen.getByText(/Em 2021, a partir de 2 de abril: o maior trecho com menos de 1 mm por dia/)).toBeInTheDocument()
    expect(screen.getByText(/Anos com algum dia de 35 °C ou mais entre março e maio \(NASA POWER\)\. Foi em 2019 e 2024\./)).toBeInTheDocument()
    expect(screen.getByText(/Em chuva de março a maio, sua área é mais seca que 64% da região\./)).toBeInTheDocument()
  })

  it('"Não é? Trocar" fica no bloco do solo e abre a escolha embaixo do painel', async () => {
    const props = setup({ ...full, soilOpen: true })

    const panel = screen.getByRole('region', { name: 'Raio-X da sua terra' })
    expect(within(panel).getByRole('button', { name: 'Fechar' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.queryByRole('heading', { name: 'Terra argilosa' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Arenosa/ }))
    expect(props.onChooseSoil).toHaveBeenCalledWith('arenoso')
  })

  it('solo da célula vizinha: o bloco diz a distância', () => {
    const neighbor = { ...raio, solo: { ...raio.solo!, vizinho_km: 6.2 } }
    setup({ ...full, xray: { ...xray, raio: neighbor, blocks: xRayBlocks(neighbor) } })

    expect(screen.getByText(/usamos o ponto mais perto, a 6,2 km\./)).toBeInTheDocument()
  })

  it('bloco sem dado não aparece', () => {
    const partial = { ...raio, umidade: null, regiao: null }
    setup({ ...full, xray: { ...xray, raio: partial, blocks: xRayBlocks(partial) } })

    expect(screen.queryByRole('heading', { name: 'Umidade da terra agora' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sua área e a região' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Solo' })).toBeInTheDocument()
  })

  it('"Saiba mais" leva aos artigos do Guia que existem', () => {
    setup(full)

    expect(screen.getAllByRole('link', { name: 'Saiba mais: Como ler o raio-X da sua terra' })[0]).toHaveAttribute('href', '/guia/raio-x')
    expect(screen.getByRole('link', { name: 'Saiba mais: Veranico' })).toHaveAttribute('href', '/guia/veranico')
    expect(screen.getByRole('link', { name: 'Saiba mais: Calor de 35 °C na floração' })).toHaveAttribute('href', '/guia/calor-35-graus')
  })

  it('histórico em faixa de calor: um ano por linha, com o que aconteceu escrito e as marcas no topo', () => {
    setup(full)

    expect(screen.getByRole('heading', { name: 'Na entressafra, sua área ficou parada em 5 de 10 anos.' })).toBeInTheDocument()
    const figure = screen.getByRole('img', { name: /Verde da lavoura pelo satélite MODIS, de 2017 a 2026/ })
    expect(within(figure).getByText('2017')).toBeInTheDocument()
    expect(within(figure).getAllByText('parada')).toHaveLength(4)
    expect(within(figure).getByText('parada (você)')).toBeInTheDocument()
    expect(within(figure).getByText('soja')).toBeInTheDocument()
    expect(within(figure).getByText('colheita')).toBeInTheDocument()
    expect(within(figure).getByText('entressafra')).toBeInTheDocument()
    expect(screen.getByText('0,75 ou mais')).toBeInTheDocument()
    expect(screen.getByText('sem leitura (nuvem)')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Plantou em/ })).not.toBeInTheDocument()
  })

  it('o aviso "Não parece uma lavoura de soja" não leva selo de pronto', () => {
    setup({ ...full, history: null, noSoy: true })

    const warning = screen.getByRole('heading', { name: 'Não parece uma lavoura de soja. Confira o ponto no mapa.' })
    expect(warning.closest('section')?.querySelector('[aria-label="Pronto"]')).toBeNull()
  })

  it('alertas da área: só os que o dado indica, com a frase da erosão na chuva forte', () => {
    setup({
      ...full,
      alerts: alertList({
        ...raio,
        alertas: {
          geada: { anos: [2011, 2021], total_anos: 20, temp_c: 3, menor_temp_c: 2.4, fonte: 'nasa_power' },
          chuva_forte: raio.alertas.chuva_forte,
          fogo: { anos: [2017, 2019, 2021], total_anos: 10, raio_km: 5, fonte: 'MODIS MCD64A1' },
        },
      }),
    })

    expect(screen.getByRole('heading', { name: 'Alertas da sua área' })).toBeInTheDocument()
    expect(screen.getByText('Em 2 de 20 anos, a mínima chegou a 3 °C ou menos entre maio e julho (NASA POWER).')).toBeInTheDocument()
    expect(screen.getByText(/Terra descoberta perde solo nesses dias\./)).toBeInTheDocument()
    expect(screen.getByText('Houve fogo a até 5 km do seu ponto em 3 de 10 anos (MODIS, NASA).')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Saiba mais: Geada na safrinha' })).toHaveAttribute('href', '/guia/geada-na-safrinha')
    expect(screen.getByRole('link', { name: 'Saiba mais: Fogo na palha' })).toHaveAttribute('href', '/guia/fogo-na-palha')
    // Tarefa 0049: o artigo da erosão existe, e a chuva forte liga para ele.
    expect(screen.getByRole('link', { name: 'Saiba mais: Como evitar erosão' })).toHaveAttribute('href', '/guia/como-evitar-erosao')
    expect(screen.queryByText(/granizo/i)).not.toBeInTheDocument()
  })

  it('sem alerta, a fileira não aparece', () => {
    setup({ ...full, alerts: [] })

    expect(screen.queryByRole('heading', { name: 'Alertas da sua área' })).not.toBeInTheDocument()
  })

  it('cartões menores com o número principal e "ver na sugestão", no lugar dos cartões de antes', () => {
    setup(full)

    expect(screen.getByRole('heading', { name: '20 anos de chuva' })).toBeInTheDocument()
    expect(screen.getByText('16 de 20')).toBeInTheDocument()
    expect(screen.getByText('anos em que milho com braquiária deu certo (GPM IMERG e NASA POWER).')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Clima 2041–2060' })).toBeInTheDocument()
    expect(screen.getByText('Chuva de março a maio: -4,5%')).toBeInTheDocument()
    expect(screen.getByText('Máxima: +1,6 °C')).toBeInTheDocument()
    expect(screen.getByText('2 de 3 modelos indicam menos chuva; 3 de 3, mais calor.')).toBeInTheDocument()
    for (const link of screen.getAllByRole('link', { name: 'ver na sugestão' })) {
      expect(link).toHaveAttribute('href', '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio')
    }
    expect(screen.queryByRole('heading', { name: '20 anos de chuva daqui' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Clima dos próximos anos' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver o que plantar' })).toBeInTheDocument()
  })

  it('em inglês', () => {
    setup({ ...full, t: en, lang: 'en' })

    expect(screen.getByRole('region', { name: "Your land's X-ray" })).toBeInTheDocument()
    expect(screen.getByText('Near Uberlândia (MG)')).toBeInTheDocument()
    expect(screen.getByText(/In March to May rain, your area is drier than 64% of the region\./)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'In the off-season, your field was left idle in 5 of 10 years.' })).toBeInTheDocument()
    expect(screen.getByText('March to May rain: -4.5%')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Alerts for your area' })).toBeInTheDocument()
  })
})
