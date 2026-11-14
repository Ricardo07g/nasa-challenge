import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import {
  Disclaimer,
  Disclosure,
  NumberedSteps,
  OptionCompareCard,
  PageHeading,
  RecommendationHero,
  ScoreTable,
  YearTimeline,
} from './Content'

describe('PageHeading', () => {
  it('mostra o título principal e o subtítulo', () => {
    render(<PageHeading title="Plano de 3 anos" subtitle="Um ano de cada vez." />)

    expect(screen.getByRole('heading', { level: 1, name: 'Plano de 3 anos' })).toBeInTheDocument()
    expect(screen.getByText('Um ano de cada vez.')).toBeInTheDocument()
  })
})

describe('NumberedSteps', () => {
  it('lista os passos em ordem', () => {
    render(<NumberedSteps steps={['Semeie.', 'Colha.', 'Plante a soja.']} />)

    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[2]).toHaveTextContent('3Plante a soja.')
  })
})

describe('Disclosure', () => {
  it('abre e fecha o conteúdo', async () => {
    render(
      <Disclosure openLabel="Por quê?" closeLabel="Fechar">
        <p>Faltou chuva em abril.</p>
      </Disclosure>,
    )

    const button = screen.getByRole('button', { name: 'Por quê?' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Faltou chuva em abril.')).not.toBeInTheDocument()

    await userEvent.click(button)

    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Faltou chuva em abril.')).toBeInTheDocument()
  })
})

describe('Disclaimer', () => {
  it('mostra o aviso', () => {
    render(<Disclaimer>Não substitui o agrônomo.</Disclaimer>)

    expect(screen.getByText('Não substitui o agrônomo.')).toBeInTheDocument()
  })
})

describe('RecommendationHero', () => {
  it('destaca a melhor opção', () => {
    render(
      <RecommendationHero label="A melhor opção" title="Milho com braquiária">
        <p>Plante logo.</p>
      </RecommendationHero>,
    )

    expect(screen.getByText('A melhor opção')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Milho com braquiária' })).toBeInTheDocument()
    expect(screen.getByText('Plante logo.')).toBeInTheDocument()
  })
})

describe('YearTimeline', () => {
  it('mostra cada ano com a cultura e o motivo', () => {
    render(
      <YearTimeline
        label="Plano ano a ano"
        items={[
          { year: 2027, title: 'Milho com braquiária', text: 'Dá grão e cobre a terra.' },
          { year: 2028, title: 'Crotalária', text: 'Adubo natural.' },
        ]}
      />,
    )

    const list = screen.getByRole('list', { name: 'Plano ano a ano' })
    expect(list.querySelectorAll('li')).toHaveLength(2)
    expect(list).toHaveTextContent('2027Milho com braquiáriaDá grão e cobre a terra.')
  })
})

describe('OptionCompareCard', () => {
  it('mostra posição, nome e as linhas', () => {
    render(
      <OptionCompareCard
        rank="Nº 1"
        name="Milho com braquiária"
        highlighted
        rows={[
          { label: 'Chuva', value: 'Deu certo em 14 de 20 anos' },
          { label: 'Dinheiro', value: 'Sobra perto de R$ 700/ha' },
        ]}
      />,
    )

    const card = screen.getByRole('article', { name: 'Milho com braquiária' })
    expect(card).toHaveAttribute('data-highlighted', 'true')
    expect(card).toHaveTextContent('Nº 1')
    expect(card).toHaveTextContent('ChuvaDeu certo em 14 de 20 anos')
  })
})

describe('RecommendationHero como título da página', () => {
  it('pode ser o h1 (na resposta, o nome da cultura é o título principal)', () => {
    render(<RecommendationHero as="h1" label="A melhor opção" title="Milho com braquiária" />)

    expect(screen.getByRole('heading', { level: 1, name: 'Milho com braquiária' })).toBeInTheDocument()
  })

  it('por padrão é h2', () => {
    render(<RecommendationHero label="A melhor opção" title="Sorgo" />)

    expect(screen.getByRole('heading', { level: 2, name: 'Sorgo' })).toBeInTheDocument()
  })
})

describe('OptionCompareCard no formato do Lovable', () => {
  it('cada linha pode ter ícone e o rótulo Bom/Médio/Fraco', () => {
    render(
      <OptionCompareCard
        rank="1º"
        name="Sorgo"
        rows={[
          {
            label: 'Chuva',
            value: 'Deu certo em 17 de 20 anos',
            icon: <svg data-testid="gota" />,
            iconTone: 'blue',
            pill: <span>Bom</span>,
          },
        ]}
      />,
    )

    const card = screen.getByRole('article', { name: 'Sorgo' })
    expect(card).toHaveTextContent('ChuvaDeu certo em 17 de 20 anosBom')
    expect(screen.getByTestId('gota').parentElement).toHaveAttribute('data-tone', 'blue')
  })

  it('fora da janela de plantio, mostra o aviso no lugar das linhas', () => {
    render(
      <OptionCompareCard
        rank="4º"
        name="Milho sozinho"
        unavailable="Fora da janela de plantio"
        rows={[{ label: 'Chuva', value: 'Deu certo em 14 de 20 anos' }]}
      />,
    )

    const card = screen.getByRole('article', { name: 'Milho sozinho' })
    expect(card).toHaveAttribute('data-unavailable', 'true')
    expect(card).toHaveTextContent('Fora da janela de plantio')
    expect(card).not.toHaveTextContent('Deu certo')
  })
})

describe('ScoreTable', () => {
  it('tabela com cabeçalho e uma linha por opção', () => {
    render(
      <ScoreTable
        caption="Notas da demonstração"
        headers={['Opção', 'Segurança', 'Final']}
        rows={[
          { name: 'Milho com braquiária', values: [70, 66] },
          { name: 'Sorgo', values: [85, 62] },
        ]}
      />,
    )

    const table = screen.getByRole('table', { name: 'Notas da demonstração' })
    expect(screen.getAllByRole('columnheader')).toHaveLength(3)
    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(table).toHaveTextContent('Sorgo8562')
  })
})

describe('NumberedSteps grandes', () => {
  it('tem a versão grande (como funciona)', () => {
    render(<NumberedSteps size="lg" steps={['Pegamos a chuva.']} />)

    expect(screen.getByRole('list')).toHaveAttribute('data-size', 'lg')
  })
})
