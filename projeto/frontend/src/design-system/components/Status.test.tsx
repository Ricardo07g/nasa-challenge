import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MetricRow, StatusPill, YearStrip } from './Status'

describe('StatusPill', () => {
  it('mostra o rótulo com o tom certo', () => {
    render(<StatusPill rotulo="medio">Médio</StatusPill>)

    expect(screen.getByText('Médio')).toHaveAttribute('data-rotulo', 'medio')
  })

  it.each(['bom', 'medio', 'fraco'] as const)('o rótulo %s tem um ícone, para não depender só da cor', (rotulo) => {
    render(<StatusPill rotulo={rotulo}>Rótulo</StatusPill>)

    expect(screen.getByText('Rótulo').querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })
})

describe('MetricRow', () => {
  it('mostra eixo, valor, rótulo e conteúdo extra', () => {
    render(
      <MetricRow icon={<svg />} label="Chuva" value="Deu certo em 14 de 20 anos" pill={<StatusPill rotulo="medio">Médio</StatusPill>}>
        <span>faixa</span>
      </MetricRow>,
    )

    expect(screen.getByText('Chuva')).toBeInTheDocument()
    expect(screen.getByText('Deu certo em 14 de 20 anos')).toBeInTheDocument()
    expect(screen.getByText('Médio')).toBeInTheDocument()
    expect(screen.getByText('faixa')).toBeInTheDocument()
  })

  it('o ícone da chuva pode ficar azul (dado de satélite)', () => {
    render(<MetricRow icon={<svg data-testid="icone" />} iconTone="blue" label="Chuva" value="14 de 20" />)

    expect(screen.getByTestId('icone').parentElement).toHaveAttribute('data-tone', 'blue')
  })
})

describe('YearStrip', () => {
  it('desenha um quadrinho por ano, com descrição acessível', () => {
    render(<YearStrip label="14 anos bons e 6 com falta de água" cells={['good', 'good', 'bad']} />)

    const strip = screen.getByRole('img', { name: '14 anos bons e 6 com falta de água' })
    const cells = strip.querySelectorAll('[data-state]')
    expect(cells).toHaveLength(3)
    expect(strip.querySelectorAll('[data-state="good"]')).toHaveLength(2)
    expect(strip.querySelectorAll('[data-state="bad"]')).toHaveLength(1)
  })

  it('no tamanho grande mostra o ano embaixo de cada quadrinho', () => {
    render(
      <YearStrip
        label="Plantou em 1 de 3 anos"
        size="lg"
        cells={['bad', 'good', 'unknown']}
        years={['16', '17', '18']}
      />,
    )

    const strip = screen.getByRole('img', { name: 'Plantou em 1 de 3 anos' })
    expect(strip).toHaveAttribute('data-size', 'lg')
    expect(strip).toHaveTextContent('161718')
  })
})
