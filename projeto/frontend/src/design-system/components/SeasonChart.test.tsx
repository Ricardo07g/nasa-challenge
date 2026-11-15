import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SeasonChart, type SeasonChartProps } from './SeasonChart'

const cells = (level: 0 | 1 | 2 | 3 | 4 | 5) => Array.from({ length: 14 }, (_, index) => ({ level, title: `coluna ${index}` }))

const props: SeasonChartProps = {
  title: 'Na entressafra, sua área ficou parada em 1 de 10 safras',
  seasonLabel: 'Safra',
  afterLabel: 'Depois da soja',
  columns: 14,
  marks: [
    { key: 'soy', label: 'Soja', from: 0, to: 3 },
    { key: 'harvest', label: 'Colheita', from: 3, to: 4 },
    { key: 'after', label: 'Depois da soja', from: 4, to: 14 },
  ],
  months: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul'].map((label, index) => ({ label, from: index * 2, span: 2 })),
  rows: [
    { key: 2017, season: '2016/17', period: 'jan–jul 2017', tone: 'plain', cells: cells(5), status: 'satélite: plantou' },
    { key: 2026, season: '2025/26', period: 'jan–jul 2026', tone: 'confirmable', cells: cells(3), status: '✓ Deixei parado' },
    { key: 2027, season: '2026/27', period: 'jan–jul 2027', tone: 'current', cells: null, status: 'a planejar' },
  ],
  legend: {
    title: 'Verde (NDVI):',
    levels: ['menos de 0,30', '0,30 a 0,45', '0,45 a 0,60', '0,60 a 0,75', '0,75 ou mais'],
    noReading: null,
    current: 'safra atual (ainda sem leitura)',
    source: 'MODIS NDVI · NASA · 250 m',
  },
}

describe('SeasonChart (gráfico "Suas últimas safras")', () => {
  it('uma figura com o título, uma linha por safra e o que veio depois da soja à direita', () => {
    render(<SeasonChart {...props} />)

    const figure = screen.getByRole('figure', { name: 'Na entressafra, sua área ficou parada em 1 de 10 safras' })
    const rows = within(figure).getAllByRole('listitem').filter((item) => item.hasAttribute('data-tone'))
    expect(rows).toHaveLength(3)
    expect(rows[0]).toHaveTextContent('2016/17')
    expect(rows[0]).toHaveTextContent('jan–jul 2017')
    expect(rows[0]).toHaveTextContent('satélite: plantou')
    expect(rows[1]).toHaveAttribute('data-tone', 'confirmable')
    expect(rows[2]).toHaveAttribute('data-tone', 'current')
  })

  it('dentro das barras não entra nenhum texto: só as cores das leituras (regra geral 5)', () => {
    const { container } = render(<SeasonChart {...props} />)

    const tracks = container.querySelectorAll('[data-track]')
    expect(tracks).toHaveLength(3)
    tracks.forEach((track) => expect(track).toHaveTextContent(''))
    expect(tracks[0].querySelectorAll('[data-level="5"]')).toHaveLength(14)
    // A safra atual não tem leitura: 14 quadrinhos tracejados, vazios.
    expect(tracks[2].getAttribute('data-empty')).toBe('current')
    expect(tracks[2].children).toHaveLength(14)
  })

  it('safra sem leitura do satélite: a barra fica listrada', () => {
    const { container } = render(
      <SeasonChart {...props} rows={[{ key: 2024, season: '2023/24', period: 'jan–jul 2024', tone: 'confirmable', cells: null, status: 'Falta confirmar' }]} />,
    )

    expect(container.querySelector('[data-track]')!.getAttribute('data-empty')).toBe('stripes')
  })

  it('cabeçalho com as faixas (soja, colheita, depois da soja) e os meses, nas colunas certas', () => {
    const { container } = render(<SeasonChart {...props} />)

    const soy = screen.getByText('Soja')
    expect(soy).toHaveStyle({ gridColumn: '1 / 4' })
    expect(screen.getByText('Colheita')).toHaveStyle({ gridColumn: '4 / 5' })
    expect(screen.getByText('jul')).toHaveStyle({ gridColumn: '13 / span 2' })
    expect(container.querySelector('[data-chart-head]')).toHaveAttribute('aria-hidden', 'true')
  })

  it('legenda: as 5 cores do NDVI com os números, a safra atual e a fonte', () => {
    render(<SeasonChart {...props} />)

    expect(screen.getByText('Verde (NDVI):')).toBeInTheDocument()
    expect(screen.getByText('0,75 ou mais')).toBeInTheDocument()
    expect(screen.getByText('safra atual (ainda sem leitura)')).toBeInTheDocument()
    expect(screen.getByText('MODIS NDVI · NASA · 250 m')).toBeInTheDocument()
  })

  it('sem NDVI, a legenda só diz "sem leitura do satélite" e a safra atual', () => {
    render(<SeasonChart {...props} legend={{ title: null, levels: [], noReading: 'sem leitura do satélite', current: 'safra atual (ainda sem leitura)', source: null }} />)

    expect(screen.getByText('sem leitura do satélite')).toBeInTheDocument()
    expect(screen.queryByText('Verde (NDVI):')).not.toBeInTheDocument()
  })
})
