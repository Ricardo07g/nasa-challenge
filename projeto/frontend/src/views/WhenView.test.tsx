import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { WhenView, type WhenViewProps } from './WhenView'

function setup(overrides: Partial<WhenViewProps> = {}) {
  const props: WhenViewProps = {
    t: pt,
    lang: 'pt',
    backTo: '/onde?lat=-18.9543&lon=-48.1993',
    suggestion: { faixa: 'meio', fromSatellite: true },
    selected: 'meio',
    dateOpen: false,
    date: '',
    dateBand: null,
    window: { min: '2027-01-15', max: '2027-03-31' },
    onSelect: vi.fn(),
    onOpenDate: vi.fn(),
    onDateChange: vi.fn(),
    onConfirm: vi.fn(),
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
  it('mostra a pergunta 2 de 2, a sugestão do satélite e as faixas com a sugerida marcada', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Quando você colhe a soja?' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Pergunta 2 de 2' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', '/onde?lat=-18.9543&lon=-48.1993')
    expect(screen.getByText('Pelo satélite, a soja daqui costuma secar no', { exact: false })).toHaveTextContent(
      'Pelo satélite, a soja daqui costuma secar no meio de fevereiro. Já deixamos marcado.',
    )
    expect(screen.getByRole('button', { name: /Meio de fevereiro/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Começo de fevereiro/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /Colocar a data exata/ })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Não tem certeza? Deixe como está. Dá para mudar depois.')).toBeInTheDocument()
  })

  it('sem dado do satélite, diz que deixou o meio de fevereiro', () => {
    setup({ suggestion: { faixa: 'meio', fromSatellite: false } })

    expect(
      screen.getByText('Não deu para ver pelo satélite. Deixamos marcado o meio de fevereiro.'),
    ).toBeInTheDocument()
  })

  it('tocar numa faixa, na data exata e no próximo passo chama o controller', async () => {
    const props = setup()

    await userEvent.click(screen.getByRole('button', { name: /Fim de fevereiro ou março/ }))
    await userEvent.click(screen.getByRole('button', { name: /Colocar a data exata/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Próximo passo Ver a resposta' }))

    expect(props.onSelect).toHaveBeenCalledWith('tarde')
    expect(props.onOpenDate).toHaveBeenCalled()
    expect(props.onConfirm).toHaveBeenCalled()
  })

  it('com a data aberta e um dia válido, diz em qual faixa ele cai', () => {
    setup({ dateOpen: true, date: '2027-02-18', dateBand: 'meio' })

    expect(screen.getByLabelText('Dia da colheita')).toHaveValue('2027-02-18')
    expect(screen.getByRole('status')).toHaveTextContent('Dia 18 de fevereiro: conta como meio de fevereiro.')
    expect(screen.getByRole('button', { name: /Colocar a data exata/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Meio de fevereiro/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('com a data aberta e sem dia válido, pede um dia da época de colheita', () => {
    setup({ dateOpen: true })

    expect(screen.getByRole('status')).toHaveTextContent('Escolha um dia dentro da época de colheita.')
  })

  it('explica por que pergunta, com o gráfico da chuva por mês', () => {
    setup()

    const why = screen.getByRole('complementary', { name: 'Por que perguntamos isso?' })
    expect(why).toHaveTextContent('A chuva vai acabando depois de março.')
    expect(screen.getByRole('img', { name: 'Chuva média por mês: muita em janeiro, pouca em junho' })).toBeInTheDocument()
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en', dateOpen: true, date: '2027-02-18', dateBand: 'meio' })

    expect(screen.getByRole('heading', { level: 1, name: 'When do you harvest your soybeans?' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('February 18 counts as mid-February.')
  })
})
