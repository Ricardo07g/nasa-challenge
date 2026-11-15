import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CountUp, InstrumentBlock, InstrumentPanel, Meter, NdviHeatmap, SourceBadge, SplitBar } from './Instrument'

describe('Instrument (painel "Raio-X da sua terra")', () => {
  it('painel com título, cabeçalho, blocos e rodapé', () => {
    render(
      <InstrumentPanel title="Raio-X da sua terra" header={<p>Perto de Uberlândia</p>} footer="Cada dado vale para a área em volta.">
        <InstrumentBlock index={0} label="Solo" value="42" unit="% de argila" sentence="Terra argilosa." badge="SoilGrids · ISRIC · 250 m" />
      </InstrumentPanel>,
    )

    const panel = screen.getByRole('region', { name: 'Raio-X da sua terra' })
    expect(within(panel).getByText('Perto de Uberlândia')).toBeInTheDocument()
    expect(within(panel).getByRole('heading', { level: 3, name: 'Solo' })).toBeInTheDocument()
    expect(within(panel).getByText('42')).toBeInTheDocument()
    expect(within(panel).getByText('% de argila')).toBeInTheDocument()
    expect(within(panel).getByText('Terra argilosa.')).toBeInTheDocument()
    expect(within(panel).getByText('SoilGrids · ISRIC · 250 m')).toBeInTheDocument()
    expect(within(panel).getByText('Cada dado vale para a área em volta.')).toBeInTheDocument()
  })

  it('selo da fonte e da resolução', () => {
    render(<SourceBadge>SMAP · NASA · 9 km</SourceBadge>)

    expect(screen.getByText('SMAP · NASA · 9 km')).toBeInTheDocument()
  })

  it('barra dividida com o rótulo e a % de cada parte', () => {
    render(
      <SplitBar
        label="Argila 42%, silte 18% e areia 40%"
        parts={[
          { key: 'clay', label: 'Argila', pct: 42 },
          { key: 'silt', label: 'Silte', pct: 18 },
          { key: 'sand', label: 'Areia', pct: 40 },
        ]}
      />,
    )

    expect(screen.getByRole('img', { name: 'Argila 42%, silte 18% e areia 40%' })).toBeInTheDocument()
    expect(screen.getByText('Argila 42%')).toBeInTheDocument()
    expect(screen.getByText('Areia 40%')).toBeInTheDocument()
  })

  it('medidor de 0 a 100 com o valor para o leitor de tela', () => {
    render(<Meter label="Umidade da terra agora" value={59} lowLabel="mais seca" highLabel="mais úmida" />)

    const meter = screen.getByRole('meter', { name: 'Umidade da terra agora' })
    expect(meter).toHaveAttribute('aria-valuenow', '59')
    expect(screen.getByText('mais seca')).toBeInTheDocument()
  })

  it('número que conta até o valor: o texto é sempre o valor final', () => {
    render(<CountUp value={862.1} format={(n) => n.toFixed(0)} />)

    expect(screen.getByText('862')).toBeInTheDocument()
  })
})

describe('NdviHeatmap (faixa de calor do NDVI)', () => {
  const props = {
    label: 'Verde da lavoura de 2017 a 2018',
    months: [
      { label: 'jan', from: 0, span: 2 },
      { label: 'fev', from: 2, span: 1 },
    ],
    marks: [
      { label: 'soja', from: 0, to: 2 },
      { label: 'colheita', from: 2, to: 3 },
    ],
    rows: [
      { year: 2017, tag: 'parada', cells: [{ level: 5 as const, title: '0,84' }, { level: 2 as const, title: '0,35' }, { level: 0 as const, title: 'sem leitura' }] },
      { year: 2018, tag: 'plantou (você)', cells: [{ level: 5 as const, title: '0,9' }, { level: 4 as const, title: '0,7' }, { level: 4 as const, title: '0,68' }] },
    ],
    legend: [
      { level: 1 as const, label: 'menos de 0,30' },
      { level: 5 as const, label: '0,75 ou mais' },
    ],
    noDataLabel: 'sem leitura (nuvem)',
  }

  it('desenha um ano por linha com o que aconteceu escrito ao lado', () => {
    render(<NdviHeatmap {...props} />)

    const figure = screen.getByRole('img', { name: 'Verde da lavoura de 2017 a 2018' })
    expect(within(figure).getByText('2017')).toBeInTheDocument()
    expect(within(figure).getByText('parada')).toBeInTheDocument()
    expect(within(figure).getByText('plantou (você)')).toBeInTheDocument()
    expect(within(figure).getByText('soja')).toBeInTheDocument()
    expect(within(figure).getByText('jan')).toBeInTheDocument()
  })

  it('legenda com os números de cada cor e o sem leitura', () => {
    render(<NdviHeatmap {...props} />)

    expect(screen.getByText('menos de 0,30')).toBeInTheDocument()
    expect(screen.getByText('0,75 ou mais')).toBeInTheDocument()
    expect(screen.getByText('sem leitura (nuvem)')).toBeInTheDocument()
  })
})
