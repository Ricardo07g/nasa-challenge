import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WaterBar, YearBarsChart } from './SuggestionCharts'

const BARS = [
  { year: 2015, pct: 100, state: 'good' as const, mark: null, label: '2015: 100%. Deu certo.' },
  { year: 2016, pct: 33, state: 'bad' as const, mark: 'N', label: '2016: 33%. Faltou água. Ano de El Niño.' },
  { year: 2017, pct: 91, state: 'good' as const, mark: null, label: '2017: 91%. Deu certo.' },
]

describe('YearBarsChart (explorador ano a ano)', () => {
  it('uma barra-botão por ano, com o nome falado de cada ano e a linha de corte escrita', () => {
    render(
      <YearBarsChart label="Água ano a ano" bars={BARS} cutPct={55} cutLabel="Limite: 55%" selectedYear={null} onSelect={() => {}} />,
    )

    const group = screen.getByRole('group', { name: 'Água ano a ano' })
    expect(group.querySelectorAll('button')).toHaveLength(3)
    expect(screen.getByRole('button', { name: '2016: 33%. Faltou água. Ano de El Niño.' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Limite: 55%')).toBeInTheDocument()
  })

  it('o ano ruim não depende só da cor: tem o estado no próprio desenho', () => {
    render(<YearBarsChart label="x" bars={BARS} cutPct={55} cutLabel="Limite" selectedYear={null} onSelect={() => {}} />)

    const bad = screen.getByRole('button', { name: /2016/ })
    expect(bad.querySelector('[data-state="bad"]')).not.toBeNull()
    expect(bad).toHaveTextContent('N')
  })

  it('tocar num ano avisa qual foi, e o ano escolhido fica marcado', async () => {
    const onSelect = vi.fn()
    render(<YearBarsChart label="x" bars={BARS} cutPct={55} cutLabel="Limite" selectedYear={2017} onSelect={onSelect} />)

    expect(screen.getByRole('button', { name: /2017/ })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: /2016/ }))
    expect(onSelect).toHaveBeenCalledWith(2016)
  })

  it('tocar de novo no ano escolhido fecha o detalhe', async () => {
    const onSelect = vi.fn()
    render(<YearBarsChart label="x" bars={BARS} cutPct={55} cutLabel="Limite" selectedYear={2016} onSelect={onSelect} />)

    await userEvent.click(screen.getByRole('button', { name: /2016/ }))
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})

describe('WaterBar (linha Água)', () => {
  it('escreve os três números e desenha as barras na mesma escala', () => {
    render(
      <WaterBar
        rows={[
          { key: 'need', text: 'Precisa de 346 mm', mm: 346 },
          { key: 'rain', text: 'Costuma chover 400 mm', mm: 400 },
          { key: 'short', text: 'Falta 116 mm em ano normal', mm: 116 },
        ]}
      />,
    )

    expect(screen.getByText('Precisa de 346 mm')).toBeInTheDocument()
    expect(screen.getByText('Costuma chover 400 mm')).toBeInTheDocument()
    expect(screen.getByText('Falta 116 mm em ano normal')).toBeInTheDocument()
    const bars = document.querySelectorAll<HTMLElement>('[data-water-bar]')
    expect(bars).toHaveLength(3)
    expect(bars[1].style.width).toBe('100%')
    expect(bars[0].style.width).toBe('86.5%')
    expect(bars[2].dataset.kind).toBe('short')
  })
})
