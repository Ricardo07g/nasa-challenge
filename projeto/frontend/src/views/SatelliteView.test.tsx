import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
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
      known: 2,
      total: 2,
      situations: ['parado', 'plantou'],
      years: ['2024', '2025'],
      window: { from: 4, to: 7 },
    },
    rain: { years: 20, period: { start: '2005', end: '2024' }, skipped: 0 },
    climate: { period: { start: '2041', end: '2060' } },
    soil: { textura: 'argiloso', source: 'map' },
    soilOpen: false,
    onToggleSoil: vi.fn(),
    onChooseSoil: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <SatelliteView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('SatelliteView (tela 4)', () => {
  it('mostra os 4 cartões do que o satélite viu, cada um com o ✓ de pronto', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Pronto. O satélite já viu o resto.' })).toBeInTheDocument()
    expect(screen.getByText('Você não precisa preencher mais nada.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Sua área ficou parada em 1 de 2 anos' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Plantou em 1 de 2 anos' })).toHaveTextContent('20242025')
    expect(screen.getByText('Ficou parado')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '20 anos de chuva daqui' })).toBeInTheDocument()
    expect(screen.getByText('De 2005 a 2024, dia por dia.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Terra argilosa' })).toBeInTheDocument()
    expect(screen.getByText('Do mapa de solos.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Clima dos próximos anos' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Pronto' })).toHaveLength(4)
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute(
      'href',
      '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
  })

  const withUncertain: SatelliteViewProps['history'] = {
    idle: 5,
    planted: 4,
    uncertain: 1,
    known: 9,
    total: 10,
    situations: ['parado', 'plantou', 'parado', 'plantou', 'parado', 'incerto', 'plantou', 'parado', 'parado', 'plantou'],
    years: ['2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'],
    window: { from: 4, to: 7 },
  }

  it('com ano sem certeza, a frase conta só os anos certos e o ano fica cinza com "?"', () => {
    setup({ history: withUncertain })

    expect(screen.getByRole('heading', { name: 'Sua área ficou parada em 5 de 9 anos (1 sem certeza)' })).toBeInTheDocument()
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

    expect(screen.getByRole('heading', { name: 'Sua área ficou parada em 1 de 2 anos' })).toBeInTheDocument()
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

  it('sem dado de chuva, o cartão da chuva fica tracejado e diz "Ainda não conectado" (sem o ✓)', () => {
    setup({ rain: null })

    const card = screen.getByRole('heading', { name: 'Chuva daqui' }).closest('[data-status]')
    expect(card).toHaveAttribute('data-status', 'unavailable')
    expect(card).toHaveTextContent('Ainda não conectado')
    expect(screen.getAllByRole('img', { name: 'Pronto' })).toHaveLength(3)
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

  it('sem o CMIP6, o clima dos próximos anos não leva o ✓: diz "Ainda não conectado"', () => {
    setup({ climate: null })

    const card = screen.getByRole('heading', { name: 'Clima dos próximos anos' }).closest('[data-status]')
    expect(card).toHaveAttribute('data-status', 'unavailable')
    expect(card).toHaveTextContent('Ainda não conectado')
    expect(screen.queryByText(/Como a chuva e o calor devem mudar/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Pronto' })).toHaveLength(3)
  })

  it('sem histórico do satélite, o cartão do histórico não some: diz "Ainda não conectado"', () => {
    setup({ history: null })

    expect(screen.queryByRole('heading', { name: /ficou parada/ })).not.toBeInTheDocument()
    const card = screen.getByRole('heading', { name: 'O que cresceu depois da soja' }).closest('[data-status]')
    expect(card).toHaveAttribute('data-status', 'unavailable')
    expect(card).toHaveTextContent('Ainda não conectado')
    expect(screen.queryByRole('img', { name: /Plantou em/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Pronto' })).toHaveLength(3)
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
    expect(screen.getByRole('link', { name: 'Ver a fazenda de exemplo' })).toHaveAttribute('href', '/exemplo')
  })

  it('em inglês', () => {
    setup({ t: en })

    expect(screen.getByRole('heading', { level: 1, name: 'Done. The satellite saw the rest.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Clayey soil' })).toBeInTheDocument()
  })

  it('o histórico em inglês, com o ano sem certeza e a linha da fonte', () => {
    setup({ t: en, lang: 'en', history: withUncertain })

    expect(screen.getByRole('heading', { name: 'Your field was left idle in 5 of 9 years (1 uncertain)' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Planted in 4 of 9 years (1 uncertain)' })).toBeInTheDocument()
    expect(screen.getByText('Uncertain')).toBeInTheDocument()
    expect(screen.getByText('Seen by the MODIS satellite (NASA), from April to July each year')).toBeInTheDocument()
  })

  it('chuva, clima e histórico em inglês: 17 anos, sem o CMIP6 e sem o histórico', () => {
    setup({ t: en, rain: { years: 17, period: { start: '2005', end: '2024' }, skipped: 3 }, climate: null, history: null })

    expect(screen.getByRole('heading', { name: '17 years of rain right here' })).toBeInTheDocument()
    expect(screen.getByText('From 2005 to 2024, day by day. 3 years were left out for missing data.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Climate in the coming years' }).closest('[data-status]')).toHaveTextContent(
      'Not connected yet',
    )
    expect(screen.getByRole('heading', { name: 'What grew after soybeans' }).closest('[data-status]')).toHaveTextContent(
      'Not connected yet',
    )
  })

  it('fora da área com dados preparados: explica e oferece a fazenda de exemplo', () => {
    setup({ status: 'outside' })

    const outside = screen.getByRole('region', { name: 'Ainda não chegamos aí' })
    expect(outside).toHaveTextContent('Por enquanto, os dados estão prontos só para a região')
    expect(screen.getByRole('link', { name: 'Ver a fazenda de exemplo' })).toHaveAttribute('href', '/exemplo')
  })
})
