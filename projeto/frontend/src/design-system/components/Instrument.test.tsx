import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CountUp, InstrumentBlock, InstrumentPanel, LiveBadge, MoistureBar, SoilBar, SourceBadge } from './Instrument'

describe('Instrument (painel "Raio-X da sua terra")', () => {
  it('painel com o olho, o lugar (título), a linha de apoio, o selo da leitura, os blocos e a nota', () => {
    render(
      <InstrumentPanel
        eyebrow="Raio-X da sua terra"
        title="Lavoura de demonstração, perto de Uberlândia (MG)"
        meta="-18,9543 · -48,1993"
        aside={<LiveBadge>Leitura mais recente: 10 de novembro de 2026</LiveBadge>}
        note="Toque num bloco para ver os detalhes."
      >
        <InstrumentBlock index={0} label="Solo" value="42" unit="% de argila" line="Terra argilosa" badge="SoilGrids · ISRIC · 250 m" detailsLabel="Ver detalhes" onOpen={() => {}} />
        <InstrumentBlock index={1} label="Água que a terra guarda" value="60" unit="mm" line="Ao alcance das raízes" badge="SoilGrids + NASA POWER" detailsLabel="Ver detalhes" onOpen={() => {}} />
      </InstrumentPanel>,
    )

    const panel = screen.getByRole('region', { name: 'Lavoura de demonstração, perto de Uberlândia (MG)' })
    expect(within(panel).getByText('Raio-X da sua terra')).toBeInTheDocument()
    expect(within(panel).getByText('-18,9543 · -48,1993')).toBeInTheDocument()
    expect(within(panel).getByText('Leitura mais recente: 10 de novembro de 2026')).toBeInTheDocument()
    expect(within(panel).getAllByRole('listitem')).toHaveLength(2)
    expect(within(panel).getByText('Toque num bloco para ver os detalhes.')).toBeInTheDocument()
  })

  it('o bloco inteiro é um botão que abre o detalhe: nome, número, unidade, uma linha e o selo', async () => {
    const onOpen = vi.fn()
    render(
      <InstrumentBlock index={0} label="Solo" value="42" unit="% de argila" line="Terra argilosa" badge="SoilGrids · ISRIC · 250 m" detailsLabel="Ver detalhes" onOpen={onOpen} />,
    )

    const block = screen.getByRole('button', { name: /^Solo.*42.*% de argila.*Terra argilosa.*SoilGrids · ISRIC · 250 m.*Ver detalhes$/ })
    expect(block).toHaveAttribute('aria-haspopup', 'dialog')
    await userEvent.click(block)
    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('as barras do bloco (solo e umidade) só desenham: o número e o texto estão no bloco e no modal', () => {
    const { container } = render(
      <>
        <SoilBar clay={42} silt={18} sand={40} />
        <MoistureBar pct={59} />
      </>,
    )

    const bars = container.querySelectorAll('[aria-hidden="true"]')
    expect(bars).toHaveLength(2)
    expect(container.querySelectorAll('[data-part]')).toHaveLength(3)
    expect(container.querySelector('[data-mark]')).toHaveStyle({ left: '59%' })
  })

  it('selo da fonte e da resolução', () => {
    render(<SourceBadge>SMAP · NASA · 9 km</SourceBadge>)

    expect(screen.getByText('SMAP · NASA · 9 km')).toBeInTheDocument()
  })

  it('número que conta até o valor: o texto é sempre o valor final', () => {
    render(<CountUp value={862.1} format={(n) => n.toFixed(0)} />)

    expect(screen.getByText('862')).toBeInTheDocument()
  })
})
