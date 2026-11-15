import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { RainLeftState } from '../controllers/useWhenController'
import type { DelayCost } from '../services/delayCostService'
import type { RainChart } from '../services/monthlyRainService'
import type { RainEnd } from '../services/rainLeftService'
import { WhenView, type WhenViewProps } from './WhenView'

/** Valores redondos de teste (não são do GPM IMERG nem do NASA POWER). */
const CHART: RainChart = {
  bars: [
    { month: 'jan', mm: 289, heightPct: 100, etoMm: 134, etoHeightPct: 46 },
    { month: 'feb', mm: 221, heightPct: 76, etoMm: 122, etoHeightPct: 42 },
    { month: 'mar', mm: 207, heightPct: 72, etoMm: 122, etoHeightPct: 42 },
    { month: 'apr', mm: 90, heightPct: 31, etoMm: 109, etoHeightPct: 38 },
    { month: 'may', mm: 34, heightPct: 12, etoMm: 100, etoHeightPct: 35 },
    { month: 'jun', mm: 14, heightPct: 5, etoMm: 92, etoHeightPct: 32 },
  ],
  firstYear: 2005,
  lastYear: 2024,
  years: 20,
  sources: ['gpm_imerg'],
  eto: { source: 'nasa_power', deficitMonth: 'apr' },
}

const LEFT: Exclude<RainLeftState, null | 'loading'> = {
  date: '2027-02-25',
  medianMm: 367,
  dryMm: 276,
  endDay: '06-30',
  percentile: 20,
  firstYear: 2005,
  lastYear: 2024,
  years: 20,
  sources: ['gpm_imerg'],
  points: [
    { day: '01-15', median: 697, dry: 616 },
    { day: '02-25', median: 367, dry: 276 },
    { day: '03-31', median: 141, dry: 87 },
  ],
  maxMm: 697,
  selectedIndex: 1,
  exact: true,
  band: 'tarde',
}

const END: RainEnd = {
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

const COST: DelayCost = {
  bands: [
    { band: 'cedo', crop: 'milho_braquiaria', good: 18, total: 20 },
    { band: 'meio', crop: 'milho_braquiaria', good: 16, total: 20 },
    { band: 'tarde', crop: 'milheto', good: 20, total: 20 },
  ],
  sameCrop: false,
}

function setup(overrides: Partial<WhenViewProps> = {}) {
  const props: WhenViewProps = {
    t: pt,
    lang: 'pt',
    backTo: '/onde?lat=-18.9543&lon=-48.1993',
    suggestion: { faixa: 'tarde', fromSatellite: true, date: '2027-02-25' },
    suggestionApplied: true,
    onUseSuggestion: vi.fn(),
    selected: 'tarde',
    date: '2027-02-25',
    dateBand: 'tarde',
    window: { min: '2027-01-15', max: '2027-03-31' },
    onDateChange: vi.fn(),
    bandsOpen: false,
    onToggleBands: vi.fn(),
    onSelect: vi.fn(),
    onConfirm: vi.fn(),
    rainChart: CHART,
    rainLeft: LEFT,
    rainEnd: END,
    delayCost: COST,
    soyWarning: null,
    onDismissSoyWarning: vi.fn(),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <WhenView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('WhenView (tela 3)', () => {
  it('no topo, o dia da colheita já preenchido com o dia do satélite e a faixa em que ele cai', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Quando você colhe a soja?' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Pergunta 2 de 2' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/onde?lat=-18.9543&lon=-48.1993')
    expect(screen.getByLabelText('Dia da colheita')).toHaveValue('2027-02-25')
    expect(screen.getByRole('status')).toHaveTextContent('Dia 25 de fevereiro: conta como fim de fevereiro ou em março.')
    expect(
      screen.getByText(
        'Pelo satélite (NDVI do MODIS), a soja daqui costuma secar por volta de 25 de fevereiro (fim de fevereiro ou em março).',
        { exact: false },
      ),
    ).toHaveTextContent('Já deixamos esse dia no campo.')
    expect(screen.queryByRole('button', { name: 'Usar o dia do satélite' })).not.toBeInTheDocument()
  })

  it('a opção "Colocar a data exata" saiu; "Não sei o dia exato" abre as três faixas', async () => {
    const props = setup()

    expect(screen.queryByText(/Colocar a data exata/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Meio de fevereiro/ })).not.toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Não sei o dia exato' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(toggle)

    expect(props.onToggleBands).toHaveBeenCalled()
  })

  it('com as faixas abertas, a marcada é a do dia no campo (sugestão = seleção)', async () => {
    const props = setup({ bandsOpen: true })

    expect(screen.getByRole('button', { name: 'Não sei o dia exato' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Fim de fevereiro ou março/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Meio de fevereiro/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /Começo de fevereiro/ })).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(screen.getByRole('button', { name: /Começo de fevereiro/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Próximo passo Ver a resposta' }))

    expect(props.onSelect).toHaveBeenCalledWith('cedo')
    expect(props.onConfirm).toHaveBeenCalled()
  })

  it('com outra faixa escolhida, a faixa azul não diz que já marcou e oferece o dia do satélite', async () => {
    const props = setup({ suggestionApplied: false, date: '', dateBand: null, selected: 'meio', bandsOpen: true })

    const banner = screen.getByText(/costuma secar por volta de 25 de fevereiro/)
    expect(banner).not.toHaveTextContent('Já deixamos')
    expect(screen.getByRole('button', { name: /Meio de fevereiro/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Coloque o dia ou toque em "Não sei o dia exato".')

    await userEvent.click(screen.getByRole('button', { name: 'Usar o dia do satélite' }))

    expect(props.onUseSuggestion).toHaveBeenCalled()
  })

  it('enquanto o talhão carrega, o campo fica vazio sem pedir nada e sem faixa azul', () => {
    setup({ suggestion: null, suggestionApplied: false, date: '', dateBand: null, selected: 'meio' })

    expect(screen.getByLabelText('Dia da colheita')).toHaveValue('')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.queryByText(/Pelo satélite|Não deu para ver/)).not.toBeInTheDocument()
  })

  it('mudar o dia chama o controller; dia fora da época pede outro', async () => {
    const props = setup({ date: '2027-05-02', dateBand: null, suggestionApplied: false })

    expect(screen.getByRole('status')).toHaveTextContent('Escolha um dia dentro da época de colheita.')
    await userEvent.clear(screen.getByLabelText('Dia da colheita'))

    expect(props.onDateChange).toHaveBeenCalled()
  })

  it('sem dado do satélite, diz que deixou o meio de fevereiro só enquanto ele está marcado', () => {
    setup({ suggestion: { faixa: 'meio', fromSatellite: false, date: null }, suggestionApplied: false, date: '', dateBand: null, selected: 'meio' })

    expect(
      screen.getByText('Não deu para ver pelo satélite quando a soja daqui seca. Deixamos marcado o meio de fevereiro.'),
    ).toBeInTheDocument()
  })

  it('sem dado do satélite e com outra faixa marcada, não diz que deixou o meio', () => {
    setup({ suggestion: { faixa: 'meio', fromSatellite: false, date: null }, suggestionApplied: false, date: '', dateBand: null, selected: 'cedo' })

    expect(screen.getByText('Não deu para ver pelo satélite quando a soja daqui seca.')).toBeInTheDocument()
    expect(screen.queryByText(/Deixamos marcado/)).not.toBeInTheDocument()
  })

  it('API antiga (só a faixa do satélite): diz que marcou só se a faixa marcada é a dele', () => {
    setup({ suggestion: { faixa: 'meio', fromSatellite: true, date: null }, suggestionApplied: false, date: '', dateBand: null, selected: 'cedo' })

    const banner = screen.getByText(/Pelo satélite, a soja daqui costuma secar no/)
    expect(banner).toHaveTextContent('Pelo satélite, a soja daqui costuma secar no meio de fevereiro.')
    expect(banner).not.toHaveTextContent('Já deixamos marcado.')
  })

  it('chuva que sobra: a frase do dia escolhido, o gráfico, a fonte certa e o "Saiba mais"', () => {
    setup()

    const left = screen.getByRole('region', { name: 'Chuva que sobra depois da colheita' })
    expect(left).toHaveTextContent('Colhendo em 25 de fevereiro, sobram em média 367 mm; num ano seco, 276 mm.')
    expect(
      within(left).getByRole('img', {
        name: 'Gráfico: quanto mais tarde a colheita, menos chuva sobra. Colhendo em 25 de fevereiro, sobram 367 mm em média e 276 mm num ano seco.',
      }),
    ).toBeInTheDocument()
    expect(left).toHaveTextContent('Chuva somada do dia da colheita até 30 de junho.')
    expect(left).toHaveTextContent('só 20% dos anos tiveram menos chuva')
    expect(left).toHaveTextContent('Chuva medida pelo GPM IMERG (NASA).')
    expect(within(left).getByRole('link', { name: 'Saiba mais: Quando a chuva acaba' })).toHaveAttribute(
      'href',
      '/guia/quando-a-chuva-acaba',
    )
  })

  it('só com a faixa, a frase usa a faixa e o dia de colheita dela', () => {
    setup({ rainLeft: { ...LEFT, date: '2027-02-15', exact: false, band: 'meio' } })

    expect(
      screen.getByText('Colhendo no meio de fevereiro (por volta de 15 de fevereiro), sobram em média 367 mm; num ano seco, 276 mm.'),
    ).toBeInTheDocument()
  })

  it('fim das chuvas: a mediana, o mais cedo e o mais tarde, com a regra e a fonte', () => {
    setup()

    const left = screen.getByRole('region', { name: 'Chuva que sobra depois da colheita' })
    expect(left).toHaveTextContent(
      'Em metade dos anos, a chuva acabou até 21 de abril; o mais cedo foi 16 de março de 2021 e o mais tarde 22 de junho de 2012.',
    )
    expect(left).toHaveTextContent(
      'Fim da chuva: o primeiro dia, a partir de 1 de março, que começa 20 dias seguidos com menos de 10 mm somados. Chuva do GPM IMERG (NASA), de 2005 a 2024.',
    )
  })

  it('chuva e gasto da lavoura por mês: o mês em que a chuva fica abaixo, escrito, e as duas fontes', () => {
    setup()

    const eto = screen.getByRole('region', { name: 'Chuva e o que a lavoura gasta, mês a mês' })
    expect(eto).toHaveTextContent('Em abril, a chuva média fica menor que o que a lavoura gasta.')
    const chart = within(eto).getByRole('img', { name: /Chuva e gasto da lavoura em cada mês, em milímetros: Jan, chuva 289 e gasto 134/ })
    expect(chart.querySelectorAll('[data-bar="rain"]')).toHaveLength(6)
    expect(chart.querySelectorAll('[data-highlight="true"]')).toHaveLength(1)
    expect(within(chart).getByText('chove menos')).toBeInTheDocument()
    expect(eto).toHaveTextContent('Chuva medida pelo GPM IMERG (NASA).')
    expect(eto).toHaveTextContent('calculada com o clima do NASA POWER.')
    expect(within(eto).getByRole('link', { name: 'Saiba mais: A conta de água da lavoura' })).toHaveAttribute(
      'href',
      '/guia/conta-de-agua',
    )
  })

  it('sem a ETo (API antiga), o bloco mês a mês não aparece', () => {
    const { eto: _eto, ...withoutEto } = CHART
    void _eto
    setup({ rainChart: { ...withoutEto, bars: CHART.bars.map(({ month, mm, heightPct }) => ({ month, mm, heightPct })) } })

    expect(screen.queryByRole('region', { name: 'Chuva e o que a lavoura gasta, mês a mês' })).not.toBeInTheDocument()
  })

  it('custo do atraso: os números do motor nas três faixas, dizendo a cultura quando ela muda', () => {
    setup()

    const cost = screen.getByRole('region', { name: 'Quanto custa colher mais tarde' })
    expect(cost).toHaveTextContent(
      'Colhendo cedo, milho com braquiária deu certo em 18 de 20 anos; no meio, milho com braquiária, 16 de 20; tarde, milheto, 20 de 20.',
    )
    expect(cost).toHaveTextContent('A melhor opção muda com a época da colheita.')
    const yours = within(cost).getByText(/sua escolha/)
    expect(yours.closest('li')).toHaveTextContent('Fim de fevereiro ou março: milheto, deu certo em 20 de 20 anos (sua escolha)')
    expect(within(cost).getByRole('link', { name: 'Saiba mais: Plantar logo depois da colheita' })).toHaveAttribute(
      'href',
      '/guia/plantar-logo-depois-da-colheita',
    )
    expect(within(cost).getByRole('link', { name: 'Saiba mais: O que significa "deu certo"' })).toHaveAttribute(
      'href',
      '/guia/deu-certo',
    )
  })

  it('custo do atraso com a mesma cultura nas três faixas', () => {
    setup({
      delayCost: {
        bands: [
          { band: 'cedo', crop: 'milheto', good: 19, total: 20 },
          { band: 'meio', crop: 'milheto', good: 18, total: 20 },
          { band: 'tarde', crop: 'milheto', good: 16, total: 20 },
        ],
        sameCrop: true,
      },
    })

    const cost = screen.getByRole('region', { name: 'Quanto custa colher mais tarde' })
    expect(cost).toHaveTextContent('A melhor opção é milheto nas três épocas.')
    expect(cost).toHaveTextContent('Colhendo cedo, deu certo em 19 de 20 anos; no meio, 18 de 20; tarde, 16 de 20.')
  })

  it('carregando ou sem dado, os blocos novos não aparecem (decisão D2)', () => {
    setup({ rainLeft: 'loading', rainEnd: null, rainChart: null, delayCost: 'loading' })

    expect(screen.queryByRole('region', { name: 'Chuva que sobra depois da colheita' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Chuva e o que a lavoura gasta, mês a mês' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Quanto custa colher mais tarde' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Ainda não conectado/)).not.toBeInTheDocument()
    // A pergunta continua: o porquê e o próximo passo
    expect(screen.getByText(/A chuva vai acabando depois de março/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Próximo passo Ver a resposta' })).toBeEnabled()
  })

  it('sem soja vista no ponto na última safra (RF-24), avisa e deixa seguir', async () => {
    const props = setup({ soyWarning: { safra: '2025/26' } })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não vimos soja neste ponto na última safra (2025/26). Confira se marcou a lavoura certa.',
    )
    expect(screen.getByRole('link', { name: 'Ajustar no mapa' })).toHaveAttribute('href', '/onde?lat=-18.9543&lon=-48.1993')
    await userEvent.click(screen.getByRole('button', { name: 'Seguir mesmo assim' }))
    expect(props.onDismissSoyWarning).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Próximo passo Ver a resposta' })).toBeEnabled()
  })

  it('sem o aviso da soja, nada muda', () => {
    setup()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Seguir mesmo assim' })).not.toBeInTheDocument()
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en' })

    expect(screen.getByRole('heading', { level: 1, name: 'When do you harvest your soybeans?' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('February 25 counts as late February or in March.')
    expect(screen.getByRole('button', { name: 'I do not know the exact day' })).toBeInTheDocument()
    expect(
      screen.getByText('Harvesting on February 25, about 367 mm of rain is left on average; in a dry year, 276 mm.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'In half of the years, the rain had ended by April 21; the earliest was March 16, 2021 and the latest June 22, 2012.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('In April, the average rain falls below what the crop uses.')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Harvesting early, corn with brachiaria worked in 18 of 20 years; in the middle, corn with brachiaria, 16 of 20; late, pearl millet, 20 of 20.',
      ),
    ).toBeInTheDocument()
  })
})
