import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { buildAnswer } from '../services/recomendacaoRules'
import { AnswerView, type AnswerViewProps } from './AnswerView'

const params = { lat: -18.9543, lon: -48.1993, colheita: 'meio' as const }
const nav = {
  label: 'Telas da resposta',
  backTo: '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
  tabs: [
    { to: '/resposta', label: 'Resposta', current: true },
    { to: '/plano', label: 'Plano de 3 anos', current: false },
    { to: '/opcoes', label: 'Todas as opções', current: false },
  ],
}

function setup(overrides: Partial<AnswerViewProps> = {}) {
  const props: AnswerViewProps = {
    t: pt,
    lang: 'pt',
    nav,
    status: 'ready',
    onRetry: vi.fn(),
    answer: buildAnswer(buildRecomendacao(params, 'pt')),
    aviso: 'Ajuda a decidir. Não substitui o agrônomo.',
    sampleData: false,
    ...overrides,
  }
  render(
    <MemoryRouter>
      <AnswerView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('AnswerView (tela 5)', () => {
  it('mostra a melhor opção em destaque, com o prazo do ZARC', () => {
    setup()

    expect(screen.getByText('Depois da soja de 2027, na sua lavoura:')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Milho com braquiária' })).toBeInTheDocument()
    expect(screen.getByText('A melhor opção')).toBeInTheDocument()
    expect(screen.getByText('Plante logo depois de colher a soja, até 28 de fevereiro.')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Telas da resposta' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('href', nav.backTo)
  })

  it('mostra chuva, dinheiro e terra com o rótulo de cada um e os 20 anos de chuva', () => {
    setup()

    expect(screen.getByText('Deu certo em 14 de 20 anos')).toBeInTheDocument()
    expect(screen.getByText('Sobra perto de R$ 700 por hectare')).toBeInTheDocument()
    expect(screen.getByText('Fica coberta na seca')).toBeInTheDocument()
    expect(screen.getByText('Médio')).toBeInTheDocument()
    expect(screen.getAllByText('Bom')).toHaveLength(2)
    expect(screen.getByRole('group', { name: '14 anos bons e 6 anos com falta de água' })).toBeInTheDocument()
    expect(screen.getByText('Choveu o bastante')).toBeInTheDocument()
    expect(screen.getByText('Faltou chuva')).toBeInTheDocument()
    expect(screen.getByText('2006–2025')).toBeInTheDocument()
  })

  it('"Por quê?" abre as frases que citam os dados da NASA', async () => {
    setup()

    await userEvent.click(screen.getByRole('button', { name: 'Por quê?' }))

    expect(screen.getByText(/faltou chuva bem nessa hora \(GPM IMERG \+ NASA POWER\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument()
  })

  it('"Como fazer" com os passos numerados e a nota do agrônomo', () => {
    setup()

    const how = screen.getByRole('region', { name: 'Como fazer' })
    expect(within(how).getAllByRole('listitem')).toHaveLength(3)
    expect(how).toHaveTextContent('Semeie o capim junto com o milho.')
    expect(how).toHaveTextContent('Dose de semente e herbicida: combine com o seu agrônomo.')
  })

  it('"Se você prefere…" com as três alternativas', () => {
    setup()

    const prefer = screen.getByRole('region', { name: 'Se você prefere…' })
    expect(within(prefer).getByRole('heading', { name: 'Sorgo' })).toBeInTheDocument()
    expect(within(prefer).getByText('Menos risco de seca')).toBeInTheDocument()
    expect(within(prefer).getByRole('heading', { name: 'Crotalária' })).toBeInTheDocument()
    expect(within(prefer).getAllByRole('heading', { level: 3 })).toHaveLength(3)
  })

  it('nota final com o aviso; com dados de exemplo, diz que os valores são de exemplo', () => {
    setup({ sampleData: true })

    expect(screen.getByText('Valores de exemplo. Ajuda a decidir. Não substitui o agrônomo.')).toBeInTheDocument()
  })

  it('avisa o que ficou fora da janela de plantio', () => {
    setup({ answer: buildAnswer(buildRecomendacao({ ...params, colheita: 'tarde' }, 'pt')) })

    const late = screen.getByRole('region', { name: 'Fora da janela de plantio' })
    expect(late).toHaveTextContent('Já não dá tempo: Milho sozinho fica fora da janela de plantio.')
    expect(late).toHaveTextContent('passa da data do zoneamento (ZARC)')
  })

  it('enquanto carrega, avisa e mostra os cartões vazios', () => {
    setup({ status: 'loading', answer: null })

    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
  })

  it('se não vier, explica, tenta de novo ou abre o exemplo', async () => {
    const props = setup({ status: 'error', answer: null })

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar agora.')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(props.onRetry).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Ver a fazenda de exemplo' })).toHaveAttribute('href', '/exemplo')
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en', answer: buildAnswer(buildRecomendacao(params, 'en')) })

    expect(screen.getByRole('heading', { level: 1, name: 'Corn with brachiaria' })).toBeInTheDocument()
    expect(screen.getByText('Plant right after the soybean harvest, by February 28.')).toBeInTheDocument()
  })

  it('fora da área com dados preparados: explica e oferece a fazenda de exemplo', () => {
    setup({ status: 'outside', answer: null })

    const outside = screen.getByRole('region', { name: 'Ainda não chegamos aí' })
    expect(outside).toHaveTextContent('Por enquanto, os dados estão prontos só para a região')
    expect(screen.getByRole('link', { name: 'Ver a fazenda de exemplo' })).toHaveAttribute('href', '/exemplo')
  })

  it('sem passos de "Como fazer" na API, o cartão não aparece vazio', () => {
    const answer = buildAnswer(buildRecomendacao(params, 'pt'))!
    setup({ answer: { ...answer, best: { ...answer.best, como_fazer: [] } } })

    expect(screen.queryByRole('region', { name: 'Como fazer' })).not.toBeInTheDocument()
  })

  it('tocar num ano da chuva mostra o que aconteceu naquele ano, com El Niño / La Niña (P1)', async () => {
    setup()

    expect(screen.getByText('La Niña (NOAA)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ver o ano 2007: Faltou chuva' }))

    expect(screen.getByRole('region', { name: '2007' })).toHaveTextContent(
      'Em 2007, a planta chegou na fase que mais precisa de água por volta de 15 de abril e ficou',
    )
    expect(screen.getByRole('region', { name: '2007' })).toHaveTextContent('Ano de El Niño.')
  })

  it('sem os detalhes dos anos na API, a faixa continua estática', () => {
    const answer = buildAnswer(buildRecomendacao(params, 'pt'))!
    setup({ answer: { ...answer, best: { ...answer.best, anos_detalhe: undefined } } })

    expect(screen.getByRole('img', { name: '14 anos bons e 6 anos com falta de água' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Ver o ano/ })).not.toBeInTheDocument()
  })
})
