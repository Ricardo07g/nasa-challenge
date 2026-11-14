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
