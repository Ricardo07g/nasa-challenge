import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  NeighborDots,
  NeighborRow,
  RainBarChart,
  RainEndTimeline,
  RainEtoChart,
  RainLeftChart,
  RainReadingRow,
  RegionMap,
} from './Charts'

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

/** ResizeObserver de teste: o espaço do gráfico mede `width` px (o jsdom não mede nada). */
function stubWidth(width: number) {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      callback: ResizeObserverCallback
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }
      observe(target: Element) {
        this.callback([{ target, contentRect: { width } } as ResizeObserverEntry], this as unknown as ResizeObserver)
      }
      unobserve() {}
      disconnect() {}
    },
  )
}

describe('RainLeftChart (chuva que sobra, tela 2)', () => {
  const points = [
    { median: 600, dry: 450 },
    { median: 400, dry: 300 },
    { median: 200, dry: 100 },
  ]
  const base = {
    label: 'Colhendo em 25 de fevereiro, sobram 400 mm',
    points,
    max: 600,
    ticks: [
      { index: 0, label: '15 jan' },
      { index: 2, label: '31 mar' },
    ],
    unit: 'mm',
    legend: { median: 'Em média', dry: 'Ano seco' },
  }

  it('desenha a mediana (linha cheia) e o ano seco (tracejada), com a marca e os números no dia escolhido', () => {
    render(<RainLeftChart {...base} selectedIndex={1} selectedLabels={{ median: '400 mm', dry: '300 mm' }} />)

    const chart = screen.getByRole('img', { name: 'Colhendo em 25 de fevereiro, sobram 400 mm' })
    expect(chart.querySelector('[data-line="median"]')).not.toHaveAttribute('stroke-dasharray')
    expect(chart.querySelector('[data-line="dry"]')).toHaveAttribute('stroke-dasharray')
    expect(chart.querySelector('[data-marker]')).toBeInTheDocument()
    expect(screen.getByText('400 mm')).toBeInTheDocument()
    expect(screen.getByText('300 mm')).toBeInTheDocument()
    expect(screen.getByText('15 jan')).toBeInTheDocument()
    expect(screen.getByText('Em média')).toBeInTheDocument()
    expect(screen.getByText('Ano seco')).toBeInTheDocument()
  })

  it('o eixo dos milímetros vai de 200 em 200, com a unidade em cima', () => {
    render(<RainLeftChart {...base} />)

    const chart = screen.getByRole('img', { name: base.label })
    const texts = Array.from(chart.querySelectorAll('[data-y-tick]')).map((text) => text.textContent)
    expect(texts).toEqual(['0', '200', '400', '600'])
    expect(chart.querySelector('[data-unit]')).toHaveTextContent('mm')
  })

  it('sem dia escolhido, só as curvas: nenhuma marca', () => {
    render(<RainLeftChart {...base} selectedIndex={null} />)

    expect(screen.getByRole('img', { name: base.label }).querySelector('[data-marker]')).toBeNull()
  })

  it('é desenhado na largura real do espaço, para o texto continuar legível no celular', () => {
    stubWidth(338)
    render(<RainLeftChart {...base} />)

    const chart = screen.getByRole('img', { name: base.label })
    expect(chart).toHaveAttribute('viewBox', '0 0 338 230')
    expect(chart).toHaveAttribute('width', '338')
  })
})

describe('RainEndTimeline (quando a chuva acaba)', () => {
  const props = {
    label: 'A chuva acabou entre 16 de março e 22 de junho',
    start: '03-01',
    end: '06-30',
    ticks: [
      { day: '03-01', label: '1 mar' },
      { day: '04-01', label: '1 abr' },
    ],
    points: [
      { day: '03-16', label: '16 mar · 2021', tone: 'early' as const },
      { day: '04-21', label: '21 abr · metade dos anos', tone: 'median' as const },
      { day: '06-22', label: '22 jun · 2012', tone: 'late' as const },
    ],
  }

  it('marca o ano mais cedo, a metade dos anos e o mais tarde, com o texto de cada um', () => {
    render(<RainEndTimeline {...props} />)

    const chart = screen.getByRole('img', { name: props.label })
    expect(chart.querySelectorAll('[data-point]')).toHaveLength(3)
    expect(chart.querySelector('[data-point="median"]')).toBeInTheDocument()
    expect(screen.getByText('16 mar · 2021')).toBeInTheDocument()
    expect(screen.getByText('21 abr · metade dos anos')).toBeInTheDocument()
    expect(screen.getByText('22 jun · 2012')).toBeInTheDocument()
    expect(screen.getByText('1 abr')).toBeInTheDocument()
  })

  it('é desenhada na largura real do espaço', () => {
    stubWidth(320)
    render(<RainEndTimeline {...props} />)

    expect(screen.getByRole('img', { name: props.label })).toHaveAttribute('viewBox', '0 0 320 100')
  })
})

describe('RainEtoChart (chuva e gasto da lavoura, tela 3)', () => {
  it('duas barras por mês (chuva e gasto, com padrão diferente) e o mês em destaque escrito', () => {
    render(
      <RainEtoChart
        label="Chuva e gasto por mês"
        caption="Média de 2005 a 2024"
        legend={{ rain: 'Chuva', eto: 'Gasto da lavoura' }}
        bars={[
          { label: 'Mar', rainPct: 100, etoPct: 60, rainDisplay: '207', etoDisplay: '122' },
          { label: 'Abr', rainPct: 43, etoPct: 52, rainDisplay: '90', etoDisplay: '109', tag: 'chove menos' },
        ]}
      />,
    )

    const chart = screen.getByRole('img', { name: 'Chuva e gasto por mês' })
    expect(chart.querySelectorAll('[data-bar="rain"]')).toHaveLength(2)
    expect(chart.querySelectorAll('[data-bar="eto"]')).toHaveLength(2)
    expect(chart.querySelector('[data-bar="rain"]')).toHaveStyle({ height: '100%' })
    expect(chart.querySelectorAll('[data-highlight="true"]')).toHaveLength(1)
    expect(screen.getByText('chove menos')).toBeInTheDocument()
    expect(screen.getByText('Gasto da lavoura')).toBeInTheDocument()
  })

  it('sem a legenda da fonte, a tela escreve a fonte por fora (modal grande da tela 2)', () => {
    const { container } = render(
      <RainEtoChart
        label="Chuva e gasto por mês"
        legend={{ rain: 'Chuva', eto: 'Gasto da lavoura' }}
        bars={[{ label: 'Mar', rainPct: 100, etoPct: 60, rainDisplay: '207', etoDisplay: '122' }]}
      />,
    )

    expect(container.querySelector('figcaption')).toBeNull()
  })
})
