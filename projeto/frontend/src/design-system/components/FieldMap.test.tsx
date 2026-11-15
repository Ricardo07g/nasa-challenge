import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldMap, type FieldMapProps } from './FieldMap'

const AREA = { south: -19.9, west: -49.0, north: -18.4, east: -47.5 }

/** O jsdom não mede nada: o mapa precisa de um tamanho para enquadrar e para ler o ponto do toque. */
function giveMapASize() {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(760)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(470)
}

function setup(overrides: Partial<FieldMapProps> = {}) {
  const props: FieldMapProps = {
    label: 'Mapa. Toque para marcar a lavoura.',
    point: null,
    pinLabel: 'Alfinete da lavoura',
    bounds: AREA,
    hint: 'Toque no mapa onde fica a lavoura',
    legend: 'Área do MVP: Uberlândia e Uberaba',
    legendAction: 'Saiba mais',
    onLegendAction: vi.fn(),
    fitLabel: 'Ver a área inteira',
    onFit: vi.fn(),
    zoomInLabel: 'Aproximar',
    zoomOutLabel: 'Afastar',
    view: { target: 'area', seq: 0 },
    onPick: vi.fn(),
    ...overrides,
  }
  const result = render(<FieldMap {...props} />)
  return { ...result, props }
}

/** Zoom dos ladrilhos do OpenStreetMap que o mapa pediu (".../{z}/{x}/{y}.png"). */
function tileZooms(container: HTMLElement): number[] {
  const zooms = Array.from(container.querySelectorAll<HTMLImageElement>('img.leaflet-tile')).map((img) =>
    Number(/\/(\d+)\/\d+\/\d+\.png$/.exec(img.src)?.[1]),
  )
  return [...new Set(zooms)]
}

describe('FieldMap (mapa para marcar a lavoura, tarefa 0053)', () => {
  beforeEach(() => giveMapASize())
  afterEach(() => vi.restoreAllMocks())

  it('mapa com nome, a dica no topo e a legenda da área em texto (a linha nunca fala só pela cor)', () => {
    const { container } = setup()

    expect(screen.getByRole('region', { name: 'Mapa. Toque para marcar a lavoura.' })).toBeInTheDocument()
    expect(screen.getByText('Toque no mapa onde fica a lavoura')).toBeInTheDocument()
    expect(screen.getByText('Área do MVP: Uberlândia e Uberaba')).toBeInTheDocument()
    // A área do MVP: retângulo tracejado.
    expect(container.querySelector('.leaflet-overlay-pane path')).not.toBeNull()
  })

  it('"© OpenStreetMap" sempre visível, e o crédito do Leaflet sem bandeira (regra do NASA Space Apps)', () => {
    const { container } = setup()

    const attribution = container.querySelector('.leaflet-control-attribution')
    expect(attribution).toHaveTextContent('© OpenStreetMap')
    expect(attribution).toHaveTextContent('Leaflet')
    expect(attribution?.querySelector('svg')).toBeNull()
  })

  it('zoom no canto com os nomes no idioma da tela', () => {
    setup()

    expect(screen.getByRole('button', { name: 'Aproximar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Afastar' })).toBeInTheDocument()
  })

  it('"Saiba mais" da legenda e "Ver a área inteira" chamam a tela', async () => {
    const { props } = setup()

    await userEvent.click(screen.getByRole('button', { name: 'Saiba mais' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ver a área inteira' }))

    expect(props.onLegendAction).toHaveBeenCalledOnce()
    expect(props.onFit).toHaveBeenCalledOnce()
  })

  it('sem ponto, nenhum alfinete; com ponto, o alfinete arrastável e com nome', () => {
    const { container, rerender, props } = setup()
    expect(container.querySelector('.leaflet-marker-icon')).toBeNull()

    rerender(<FieldMap {...props} point={{ lat: -18.9543, lon: -48.1993 }} />)

    const pin = screen.getByRole('button', { name: 'Alfinete da lavoura' })
    expect(pin).toHaveClass('leaflet-marker-draggable')
  })

  it('tocar no mapa marca o ponto tocado', () => {
    const { container, props } = setup()

    fireEvent.click(container.querySelector('.leaflet-container')!, { clientX: 380, clientY: 235 })

    expect(props.onPick).toHaveBeenCalledOnce()
    const [point] = vi.mocked(props.onPick).mock.calls[0]
    // O meio do mapa enquadrado na área do MVP.
    expect(point.lat).toBeCloseTo(-19.15, 1)
    expect(point.lon).toBeCloseTo(-48.25, 1)
  })

  it('arrastar o alfinete ajusta o ponto', () => {
    const { container, props } = setup({ point: { lat: -19.15, lon: -48.25 }, view: { target: 'point', seq: 1 } })
    const pin = container.querySelector<HTMLElement>('.leaflet-marker-icon')!

    // O Leaflet confere o botão pelo `which` antigo, que o jsdom não preenche.
    const down = new MouseEvent('mousedown', { bubbles: true, clientX: 380, clientY: 235, button: 0 })
    Object.defineProperty(down, 'which', { value: 1 })
    fireEvent(pin, down)
    // Movimento e soltura sobem até o document, onde o Leaflet escuta.
    fireEvent.mouseMove(pin, { clientX: 420, clientY: 260 })
    fireEvent.mouseMove(pin, { clientX: 460, clientY: 285 })
    fireEvent.mouseUp(pin, { clientX: 460, clientY: 285 })

    expect(props.onPick).toHaveBeenCalled()
    const [point] = vi.mocked(props.onPick).mock.calls.at(-1)!
    expect(point.lat).toBeLessThan(-19.15)
    expect(point.lon).toBeGreaterThan(-48.25)
  })

  it('sem ponto, abre mostrando a área inteira; com o ponto, chega perto dele (zoom 14)', () => {
    const { container, rerender, props } = setup()
    const areaZoom = Math.max(...tileZooms(container))
    expect(areaZoom).toBeLessThan(10)

    rerender(<FieldMap {...props} point={{ lat: -18.9543, lon: -48.1993 }} view={{ target: 'point', seq: 1 }} />)
    expect(tileZooms(container)).toContain(14)

    rerender(<FieldMap {...props} point={{ lat: -18.9543, lon: -48.1993 }} view={{ target: 'area', seq: 2 }} />)
    expect(Math.max(...tileZooms(container))).toBe(areaZoom)
  })

  it('a área chega depois (vem da API): o mapa enquadra assim que ela chega', () => {
    const { container, rerender, props } = setup({ bounds: undefined })

    rerender(<FieldMap {...props} bounds={AREA} />)

    expect(container.querySelector('.leaflet-overlay-pane path')).not.toBeNull()
    expect(Math.max(...tileZooms(container))).toBeLessThan(10)
  })
})
