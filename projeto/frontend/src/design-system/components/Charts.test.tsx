import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NeighborDots, NeighborRow, RainBarChart, RainReadingRow, RegionMap } from './Charts'

describe('RainBarChart', () => {
  it('desenha uma barra por mês com descrição acessível', () => {
    render(
      <RainBarChart
        label="Chuva média por mês"
        caption="Desenho de exemplo."
        bars={[
          { label: 'Jan', value: 100, tone: 'strong' },
          { label: 'Abr', value: 28, tone: 'soft' },
        ]}
      />,
    )

    const chart = screen.getByRole('img', { name: 'Chuva média por mês' })
    expect(chart.querySelectorAll('[data-bar]')).toHaveLength(2)
    expect(screen.getByText('Desenho de exemplo.')).toBeInTheDocument()
  })
})

describe('NeighborDots', () => {
  it('uma bolinha por vizinho, cheia para quem gostou', () => {
    render(<NeighborDots liked={2} total={3} label="2 de 3 vizinhos gostaram" />)

    const dots = screen.getByRole('img', { name: '2 de 3 vizinhos gostaram' })
    expect(dots.querySelectorAll('[data-liked="true"]')).toHaveLength(2)
    expect(dots.querySelectorAll('[data-liked="false"]')).toHaveLength(1)
  })
})

describe('RainReadingRow', () => {
  it('mostra o lugar e a leitura', () => {
    render(<RainReadingRow place="A 6 km, ao norte" reading="32 mm · satélite 24 mm" />)

    expect(screen.getByText('A 6 km, ao norte')).toBeInTheDocument()
    expect(screen.getByText('32 mm · satélite 24 mm')).toBeInTheDocument()
  })
})

describe('RegionMap', () => {
  it('é uma imagem descrita com a legenda visível', () => {
    render(<RegionMap label="Mapa da região" legend={{ gauge: 'Pluviômetro', planted: 'Plantou', idle: 'Parado' }} />)

    expect(screen.getByRole('img', { name: 'Mapa da região' })).toBeInTheDocument()
    expect(screen.getByText('Pluviômetro')).toBeInTheDocument()
    expect(screen.getByText('Parado')).toBeInTheDocument()
  })
})

describe('NeighborRow', () => {
  it('mostra a opção, uma bolinha por vizinho e quantos gostaram', () => {
    render(<NeighborRow name="Sorgo" liked={2} total={3} dotsLabel="2 de 3 vizinhos gostaram" likedText="2 de 3 gostaram" />)

    expect(screen.getByText('Sorgo')).toBeInTheDocument()
    const dots = screen.getByRole('img', { name: '2 de 3 vizinhos gostaram' })
    expect(dots.querySelectorAll('[data-liked]')).toHaveLength(3)
    expect(screen.getByText('2 de 3 gostaram')).toBeInTheDocument()
  })
})

describe('RainBarChart com o valor em cima das barras', () => {
  it('mostra o valor de cada barra e aceita o tom terra (área parada)', () => {
    render(
      <RainBarChart
        label="% da área parada"
        caption="Ano a ano"
        bars={[
          { label: '24', value: 63, tone: 'earth', display: '63%' },
          { label: '25', value: 62, tone: 'earth', display: '62%' },
        ]}
      />,
    )

    const chart = screen.getByRole('img', { name: '% da área parada' })
    expect(chart).toHaveTextContent('63%')
    expect(chart.querySelector('[data-tone="earth"]')).not.toBeNull()
  })

  it('o valor fica preso em cima da própria barra: não tira altura da barra mais alta', () => {
    // Antes, o texto ocupava espaço na coluna e a barra de 100% encolhia: 213 mm parecia só 14% maior
    // que 161 mm (são 32%).
    render(
      <RainBarChart
        label="Chuva média por mês"
        caption="Média de 2005 a 2024"
        bars={[
          { label: 'Jan', value: 100, tone: 'strong', display: '213' },
          { label: 'Fev', value: 76, tone: 'strong', display: '161' },
        ]}
      />,
    )

    const chart = screen.getByRole('img', { name: 'Chuva média por mês' })
    const bars = chart.querySelectorAll('[data-bar]')
    expect(bars[0]).toHaveTextContent('213')
    expect(bars[0]).toHaveStyle({ height: '100%' })
    expect(bars[1]).toHaveTextContent('161')
    expect(chart).toHaveAttribute('data-values', 'true')
  })

  it('sem valores, a área das barras não reserva espaço para eles', () => {
    render(<RainBarChart label="Chuva" caption="Exemplo" bars={[{ label: 'Jan', value: 100, tone: 'strong' }]} />)

    expect(screen.getByRole('img', { name: 'Chuva' })).not.toHaveAttribute('data-values')
  })
})
