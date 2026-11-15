import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { BandsModalState, DetailsModalState } from '../controllers/useWhenController'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { HarvestBand } from '../services/harvestBandsService'
import type { RainChart } from '../services/monthlyRainService'
import type { RainEnd, RainLeft, RainLeftCurve } from '../services/rainLeftService'
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

const CURVE: RainLeftCurve = {
  endDay: '06-30',
  percentile: 20,
  firstYear: 2005,
  lastYear: 2024,
  years: 20,
  sources: ['gpm_imerg'],
  points: [
    { day: '01-15', median: 697, dry: 616 },
    { day: '02-01', median: 520, dry: 430 },
    { day: '03-01', median: 300, dry: 220 },
    { day: '03-03', median: 290, dry: 210 },
    { day: '03-31', median: 141, dry: 87 },
  ],
  maxMm: 697,
}

const LEFT: RainLeft = { ...CURVE, date: '2027-03-03', medianMm: 290, dryMm: 210, selectedIndex: 3 }

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

const BANDS: HarvestBand[] = [
  { band: 'cedo', day: '2027-02-05', rainMm: 455, best: { crop: 'milho_braquiaria', good: 18, total: 20 }, yours: false },
  { band: 'meio', day: '2027-02-15', rainMm: 405, best: { crop: 'milho_braquiaria', good: 16, total: 20 }, yours: false },
  { band: 'tarde', day: '2027-03-03', rainMm: 290, best: { crop: 'milheto', good: 20, total: 20 }, yours: true },
]

function bandsModal(overrides: Partial<BandsModalState> = {}): BandsModalState {
  return { open: false, draft: null, onOpen: vi.fn(), onClose: vi.fn(), onDraft: vi.fn(), onSubmit: vi.fn(), ...overrides }
}

function details(overrides: Partial<DetailsModalState> = {}): DetailsModalState {
  return { open: false, onOpen: vi.fn(), onClose: vi.fn(), onUseBand: vi.fn(), ...overrides }
}

function setup(overrides: Partial<WhenViewProps> = {}) {
  const props: WhenViewProps = {
    t: pt,
    lang: 'pt',
    backTo: '/onde?lat=-18.9543&lon=-48.1993',
    listen: { supported: true, speaking: false, toggle: vi.fn() },
    window: { min: '2027-01-01', max: '2027-04-30' },
    choice: null,
    onPickDate: vi.fn(),
    canContinue: false,
    onConfirm: vi.fn(),
    notSoy: false,
    bands: BANDS.map((band) => ({ ...band, yours: false, day: band.band === 'tarde' ? '2027-02-28' : band.day })),
    rainCurve: CURVE,
    rainLeft: null,
    rainChart: CHART,
    rainEnd: END,
    heatC: 35,
    loading: false,
    bandsModal: bandsModal(),
    details: details(),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <WhenView {...props} />
    </MemoryRouter>,
  )
  return props
}

const withDate: Partial<WhenViewProps> = {
  choice: { band: 'tarde', date: '2027-03-03' },
  canContinue: true,
  rainLeft: LEFT,
  bands: BANDS,
}

describe('WhenView (tela 2 "Quando você colhe a soja?", tarefa 0057)', () => {
  it('explica, numa linha discreta junto da data, por que o calendário vai só até 30 de abril (15/11/2026)', () => {
    setup()

    const note = screen.getByText(/só até 30 de abril/)
    expect(note).toHaveTextContent('prazo de plantio (ZARC)')
    expect(note.tagName).toBe('P')
  })

  it('no topo: o Voltar de verdade, o título, a frase e o "Ouvir resumo", sem "Pergunta 2 de 2"', () => {
    setup()

    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/onde?lat=-18.9543&lon=-48.1993')
    expect(screen.getByRole('heading', { level: 1, name: 'Quando você colhe a soja?' })).toBeInTheDocument()
    expect(screen.getByText('Escolha o dia em que a colheita costuma acontecer.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ouvir resumo' })).toBeInTheDocument()
    expect(screen.queryByText(/Pergunta \d de \d/)).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('sem data: calendário vazio com "?", "Escolher data" e o Próximo passo desligado, com o motivo', () => {
    setup()

    const card = screen.getByRole('region', { name: 'Escolha o dia da colheita' })
    expect(within(card).getByText('?')).toBeInTheDocument()
    expect(within(card).getByText('Toque em “Escolher data”.')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Escolher data' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Próximo passo/ })).toBeDisabled()
    expect(screen.getByText('Escolha uma data ou toque em “Não sei o dia exato”.')).toBeInTheDocument()
    expect(screen.getByText('Escolha o dia da colheita para continuar')).toBeInTheDocument()
  })

  it('o campo de data vai de 1/jan a 30/abr de 2027 e escolher o dia chama o controller', () => {
    const props = setup()

    const input = screen.getByLabelText('Dia da colheita')
    expect(input).toHaveAttribute('type', 'date')
    expect(input).toHaveAttribute('min', '2027-01-01')
    expect(input).toHaveAttribute('max', '2027-04-30')
    fireEvent.change(input, { target: { value: '2027-03-03' } })

    expect(props.onPickDate).toHaveBeenCalledWith('2027-03-03')
  })

  it('com a data: o calendário com mês e dia, a data por extenso, o dia da semana e o selo da época', () => {
    setup(withDate)

    const card = screen.getByRole('region', { name: '3 de março de 2027' })
    expect(within(card).getByText('MAR')).toBeInTheDocument()
    expect(within(card).getByText('3')).toBeInTheDocument()
    expect(within(card).getByText('Quarta-feira')).toBeInTheDocument()
    expect(within(card).getByText('Fim de fevereiro ou março')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Trocar data' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Próximo passo/ })).toBeEnabled()
  })

  it('com a época: o calendário mostra "FEV 11–20" e o botão vira "Escolher o dia"', () => {
    setup({ choice: { band: 'meio', date: null }, canContinue: true })

    const card = screen.getByRole('region', { name: 'Meio de fevereiro' })
    expect(within(card).getByText('FEV')).toBeInTheDocument()
    expect(within(card).getByText('11–20')).toBeInTheDocument()
    expect(within(card).getByText('Época aproximada')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Escolher o dia' })).toBeInTheDocument()
  })

  it('"Próximo passo · Ver a resposta" chama o controller', async () => {
    const props = setup(withDate)

    await userEvent.click(screen.getByRole('button', { name: 'Próximo passo Ver a resposta' }))

    expect(props.onConfirm).toHaveBeenCalled()
  })

  it('"Não sei o dia exato" abre o modal das épocas', async () => {
    const props = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Não sei o dia exato' }))

    expect(props.bandsModal.onOpen).toHaveBeenCalled()
  })

  it('o modal das épocas abre sem nenhuma marcada e "Usar esta época" fica desligado', async () => {
    const modal = bandsModal({ open: true })
    setup({ bandsModal: modal })

    const dialog = screen.getByRole('dialog', { name: 'Quando costuma ser a sua colheita?' })
    const radios = within(dialog).getAllByRole('radio')
    expect(radios).toHaveLength(3)
    radios.forEach((radio) => expect(radio).not.toBeChecked())
    expect(within(dialog).getByText('Do dia 11 ao 20')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Usar esta época' })).toBeDisabled()

    await userEvent.click(within(dialog).getByRole('radio', { name: /Meio de fevereiro/ }))
    expect(modal.onDraft).toHaveBeenCalledWith('meio')
  })

  it('com uma época marcada no modal, "Usar esta época" liga e usa', async () => {
    const modal = bandsModal({ open: true, draft: 'cedo' })
    setup({ bandsModal: modal })

    const dialog = screen.getByRole('dialog', { name: 'Quando costuma ser a sua colheita?' })
    expect(within(dialog).getByRole('radio', { name: /Começo de fevereiro/ })).toBeChecked()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Usar esta época' }))

    expect(modal.onSubmit).toHaveBeenCalled()
  })

  it('aviso laranja quando o ponto não parece uma lavoura de soja, com "Conferir no mapa"', () => {
    setup({ notSoy: true })

    expect(screen.getByText('Pelo satélite, este ponto não parece uma lavoura de soja.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Conferir no mapa' })).toHaveAttribute('href', '/onde?lat=-18.9543&lon=-48.1993')
  })

  it('sem o aviso quando o satélite viu soja (ou não sabe)', () => {
    setup()

    expect(screen.queryByText('Pelo satélite, este ponto não parece uma lavoura de soja.')).not.toBeInTheDocument()
  })

  it('caixa "Ainda não decidiu?": a prévia das 3 épocas (a sua em verde) e o botão que abre o modal grande', async () => {
    const props = setup(withDate)

    const box = screen.getByRole('region', { name: 'Ainda não decidiu? Veja nossas sugestões' })
    expect(within(box).getByText('Por que perguntamos isso?')).toBeInTheDocument()
    expect(within(box).getByText('A data muda a chuva que sobra e a melhor opção para a sua terra.')).toBeInTheDocument()
    expect(within(box).getByText('Chuva que sobra até junho, em média')).toBeInTheDocument()
    expect(within(box).getByText('455 mm')).toBeInTheDocument()
    expect(within(box).getByText('Fim de fev./março').closest('[data-yours]')).toHaveAttribute('data-yours', 'true')
    expect(within(box).getByText('Começo de fev.').closest('[data-yours]')).toHaveAttribute('data-yours', 'false')
    await userEvent.click(within(box).getByRole('button', { name: 'Ver sugestões e detalhes' }))

    expect(props.details.onOpen).toHaveBeenCalled()
  })

  it('sem a chuva que sobra, a caixa fica sem a prévia (decisão D2)', () => {
    setup({ rainCurve: null, bands: BANDS.map((band) => ({ ...band, rainMm: null })) })

    const box = screen.getByRole('region', { name: 'Ainda não decidiu? Veja nossas sugestões' })
    expect(within(box).queryByText('Chuva que sobra até junho, em média')).not.toBeInTheDocument()
  })

  describe('modal grande "Nossas sugestões para a data da colheita"', () => {
    it('tem os 4 blocos com os textos abertos', () => {
      setup({ ...withDate, details: details({ open: true }) })

      const dialog = screen.getByRole('dialog', { name: 'Nossas sugestões para a data da colheita' })
      expect(within(dialog).getByText(/A chuva vai acabando depois de março/)).toBeInTheDocument()
      for (const name of ['Compare as épocas', 'Chuva que sobra para a próxima planta', 'Chuva e o que a lavoura gasta, mês a mês', 'Quando a chuva acaba']) {
        expect(within(dialog).getByRole('heading', { name })).toBeInTheDocument()
      }
      expect(within(dialog).queryByRole('button', { name: /Como fazemos essa conta/ })).not.toBeInTheDocument()
      expect(dialog.querySelector('details')).toBeNull()
    })

    it('"Compare as épocas": chuva, melhor opção e "deu certo" de cada época, com a sua destacada e "Usar esta época" nas outras', async () => {
      const modal = details({ open: true })
      setup({ ...withDate, details: modal })

      const block = screen.getByRole('region', { name: 'Compare as épocas' })
      const yours = within(block).getByText('sua época').closest('[data-band]') as HTMLElement
      expect(yours).toHaveAttribute('data-band', 'tarde')
      expect(within(yours).getByText('290 mm')).toBeInTheDocument()
      expect(within(yours).getByText('Milheto · deu certo em 20 de 20 anos')).toBeInTheDocument()
      expect(within(yours).queryByRole('button', { name: 'Usar esta época' })).not.toBeInTheDocument()
      expect(within(block).getAllByText('Milho com braquiária · deu certo em 18 de 20 anos')).toHaveLength(1)
      expect(within(block).getAllByRole('button', { name: 'Usar esta época' })).toHaveLength(2)
      expect(
        within(block).getByText(
          '“Deu certo” quer dizer que não faltou água nem fez 35 °C ou mais na floração. Conta feita com a chuva do GPM IMERG (NASA) e o calor do NASA POWER de cada ano, de 2005 a 2024.',
        ),
      ).toBeInTheDocument()

      await userEvent.click(within(block).getAllByRole('button', { name: 'Usar esta época' })[0])
      expect(modal.onUseBand).toHaveBeenCalledWith('cedo')
    })

    it('sem o número do calor (API antiga), o "deu certo" fica sem o número', () => {
      setup({ ...withDate, heatC: null, details: details({ open: true }) })

      expect(screen.getByText(/não faltou água nem fez calor forte demais na floração/)).toBeInTheDocument()
    })

    it('"Chuva que sobra": os números da data escolhida, o gráfico com a marca e o que cada linha significa', () => {
      setup({ ...withDate, details: details({ open: true }) })

      const block = screen.getByRole('region', { name: 'Chuva que sobra para a próxima planta' })
      expect(block).toHaveTextContent(
        'Colhendo em 3 de março, a próxima planta ainda recebe 290 mm de chuva até 30 de junho num ano normal, e 210 mm num ano seco.',
      )
      expect(within(block).getByRole('img', { name: /Colhendo em 3 de março, sobram 290 mm/ })).toBeInTheDocument()
      expect(block).toHaveTextContent('só 2 em cada 10 anos tiveram menos chuva que isso')
      expect(within(block).getByText('Chuva medida pelo GPM IMERG (NASA), de 2005 a 2024, no ponto da sua lavoura.')).toBeInTheDocument()
    })

    it('"Chuva que sobra" sem data: a explicação pede para escolher a data e o gráfico fica sem marca', () => {
      setup({ details: details({ open: true }) })

      const block = screen.getByRole('region', { name: 'Chuva que sobra para a próxima planta' })
      expect(block).toHaveTextContent('Escolha uma data para ver os números da sua colheita.')
      expect(within(block).getByRole('img').querySelector('[data-marker]')).toBeNull()
    })

    it('"Chuva e o que a lavoura gasta": o gráfico e só abril em destaque, com a explicação', () => {
      setup({ ...withDate, details: details({ open: true }) })

      const block = screen.getByRole('region', { name: 'Chuva e o que a lavoura gasta, mês a mês' })
      expect(within(block).getAllByText('chove menos')).toHaveLength(1)
      expect(block).toHaveTextContent('De janeiro a março chove mais do que a lavoura gasta. Em abril isso vira')
    })

    it('"Quando a chuva acaba": a linha do tempo com o mais cedo, a metade dos anos e o mais tarde, e a regra', () => {
      setup({ ...withDate, details: details({ open: true }) })

      const block = screen.getByRole('region', { name: 'Quando a chuva acaba' })
      expect(within(block).getByText('16 mar · 2021')).toBeInTheDocument()
      expect(within(block).getByText('21 abr · metade dos anos')).toBeInTheDocument()
      expect(within(block).getByText('22 jun · 2012')).toBeInTheDocument()
      expect(block).toHaveTextContent('Em metade dos anos, a chuva acabou até 21 de abril.')
      expect(block).toHaveTextContent('a partir de 1º de março, que começa 20 dias seguidos com menos de 10 mm somados')
    })

    it('cada "Saiba mais" abre o artigo do Guia em nova aba', () => {
      setup({ ...withDate, details: details({ open: true }) })

      const links = [
        ['Saiba mais: o que significa “deu certo”', '/guia/deu-certo'],
        ['Saiba mais: plantar logo depois da colheita', '/guia/plantar-logo-depois-da-colheita'],
        ['Saiba mais: a conta de água da lavoura', '/guia/conta-de-agua'],
        ['Saiba mais: quando a chuva acaba', '/guia/quando-a-chuva-acaba'],
      ]
      for (const [name, href] of links) {
        const link = screen.getByRole('link', { name: new RegExp(name) })
        expect(link).toHaveAttribute('href', href)
        expect(link).toHaveAttribute('target', '_blank')
      }
    })

    it('bloco sem dado não aparece (decisão D2)', () => {
      setup({ rainCurve: null, rainChart: null, rainEnd: null, bands: [], details: details({ open: true }) })

      const dialog = screen.getByRole('dialog', { name: 'Nossas sugestões para a data da colheita' })
      expect(within(dialog).queryByRole('heading', { name: 'Chuva que sobra para a próxima planta' })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('heading', { name: 'Chuva e o que a lavoura gasta, mês a mês' })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('heading', { name: 'Quando a chuva acaba' })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('heading', { name: 'Compare as épocas' })).not.toBeInTheDocument()
    })
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en', ...withDate })

    expect(screen.getByRole('heading', { level: 1, name: 'When do you harvest your soybeans?' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'March 3, 2027' })).toBeInTheDocument()
    expect(screen.getByText('Wednesday')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next step See the answer' })).toBeEnabled()
  })
})
