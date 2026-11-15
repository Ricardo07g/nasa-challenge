import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { SeasonsModel, XRayModel } from '../controllers/useSatelliteController'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { buildRaioX } from '../repositories/mocks/raioXFixture'
import { xRayBlocks } from '../services/raioXService'
import { seasonChart } from '../services/seasonChartService'
import { SatelliteView, type SatelliteViewProps } from './SatelliteView'

const RAIO = buildRaioX({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')
const XRAY: XRayModel = { raio: RAIO, blocks: xRayBlocks(RAIO), place: 'Uberlândia (MG)', demo: true, point: { lat: -18.9543, lon: -48.1993 } }

const SEASONS: SeasonsModel = {
  rows: [
    { year: 2024, satellite: { soy: true, after: 'plantou', ndvi: 0.71 } },
    { year: 2025, satellite: { soy: true, after: 'plantou', ndvi: 0.8 } },
    { year: 2026, satellite: { soy: true, after: 'plantou', ndvi: 0.89 } },
  ],
  answers: {},
  current: { choice: null, harvestDate: '2027-03-03', changeDateTo: '/quando?lat=-18.9543&lon=-48.1993&colheita=tarde&data=2027-03-03' },
  answered: 0,
  seen: { kind: 'all', count: 3 },
}

const historico = {
  anos: Array.from({ length: 10 }, (_, index) => ({ ano: 2017 + index, situacao: 'plantou' as const, ndvi_max: 0.8, n_obs: 12 })),
  parado: 0,
  plantou: 10,
  sem_certeza: 0,
  total: 10,
  fonte: 'MODIS',
  janela: '04-01 a 07-31',
}

function setup(overrides: Partial<SatelliteViewProps> = {}) {
  const props: SatelliteViewProps = {
    t: pt,
    lang: 'pt',
    backTo: '/quando?lat=-18.9543&lon=-48.1993&colheita=tarde',
    status: 'ready',
    onRetry: vi.fn(),
    listen: { supported: true, speaking: false, toggle: vi.fn() },
    xray: XRAY,
    detail: null,
    onOpenDetail: vi.fn(),
    onCloseDetail: vi.fn(),
    soil: { textura: 'medio', source: 'map' },
    onChooseSoil: vi.fn(),
    chart: seasonChart({ strip: RAIO.historico_ndvi, historico, answers: {}, current: null }),
    seasons: SEASONS,
    onAnswerSeason: vi.fn(),
    onChooseCurrent: vi.fn(),
    noSoy: false,
    adjustTo: '/onde?lat=-18.9543&lon=-48.1993&colheita=tarde',
    share: null,
    onConfirm: vi.fn(),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <SatelliteView {...props} />
    </MemoryRouter>,
  )
  return props
}

const NO_READING_CHART = seasonChart({ strip: null, historico: null, answers: {}, current: null, harvestDay: '03-03' })
const NO_READING: SeasonsModel = {
  ...SEASONS,
  rows: SEASONS.rows.map((row) => ({ ...row, satellite: null })),
  seen: { kind: 'no-reading', count: 0 },
}

describe('SatelliteView (tela 4: raio-X e últimas safras)', () => {
  it('topo: Voltar, o título, o subtítulo novo e o "Ouvir resumo"', async () => {
    const props = setup()

    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', props.backTo)
    expect(screen.getByRole('heading', { level: 1, name: 'Pronto. O satélite já viu o resto.' })).toBeInTheDocument()
    expect(screen.getByText('Confira o raio-X da sua terra e confirme as últimas safras.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Ouvir resumo' }))
    expect(props.listen.toggle).toHaveBeenCalled()
  })

  describe('painel do raio-X', () => {
    it('cabeçalho: o lugar (a lavoura de demonstração), as coordenadas, a leitura mais recente e a nota', () => {
      setup()

      const panel = screen.getByRole('region', { name: 'Lavoura de demonstração, perto de Uberlândia (MG)' })
      expect(within(panel).getByText('Raio-X da sua terra')).toBeInTheDocument()
      expect(within(panel).getByText('-18,9543 · -48,1993')).toBeInTheDocument()
      expect(within(panel).getByText('Leitura mais recente: 10 de novembro de 2026')).toBeInTheDocument()
      expect(
        within(panel).getByText('Toque num bloco para ver os detalhes. Cada dado vale para a área em volta do ponto, no tamanho indicado no selo.'),
      ).toBeInTheDocument()
    })

    it('fora da demonstração, o lugar é "Perto de …"', () => {
      setup({ xray: { ...XRAY, demo: false } })

      expect(screen.getByRole('region', { name: 'Perto de Uberlândia (MG)' })).toBeInTheDocument()
    })

    it('8 blocos enxutos, cada um um botão: nome, número, uma linha e o selo, sem o texto longo', () => {
      setup()

      const panel = screen.getByRole('region', { name: /Lavoura de demonstração/ })
      const blocks = within(panel).getAllByRole('button')
      expect(blocks).toHaveLength(8)
      expect(blocks[0]).toHaveAccessibleName('Solo 32 % de argila Terra média SoilGrids · ISRIC · 250 m Ver detalhes')
      expect(blocks[1]).toHaveTextContent('Aguenta ~11 dias sem chuva na floração')
      expect(within(panel).queryByText(/Pelo mapa de solos SoilGrids/)).not.toBeInTheDocument()
      expect(within(panel).queryByRole('link', { name: /Saiba mais/ })).not.toBeInTheDocument()
    })

    it('tocar num bloco pede o detalhe dele', async () => {
      const props = setup()

      await userEvent.click(screen.getByRole('button', { name: /^Água que a terra guarda/ }))
      expect(props.onOpenDetail).toHaveBeenCalledWith('water')
    })

    it('o modal do bloco: o título, o número, o texto completo, a fonte e o "Saiba mais" em nova aba', () => {
      setup({ detail: 'water' })

      const dialog = screen.getByRole('dialog', { name: 'Quanta água a terra guarda' })
      expect(within(dialog).getByText('Água que a terra guarda')).toBeInTheDocument()
      expect(within(dialog).getByText('50')).toBeInTheDocument()
      expect(within(dialog).getByText('50 mm', { selector: 'strong' })).toBeInTheDocument()
      expect(dialog).toHaveTextContent('Na floração de milho com braquiária, por volta de 19 de abril, a planta gasta uns 4,3 mm por dia.')
      expect(within(dialog).getByText(/evapotranspiração de 3,6 mm do NASA POWER/)).toBeInTheDocument()
      const link = within(dialog).getByRole('link', { name: /Saiba mais: como ler o raio-X da sua terra/ })
      expect(link).toHaveAttribute('href', '/guia/raio-x')
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('o modal do Solo tem "Sua terra é diferente?": a terra marcada e a troca', async () => {
      const props = setup({ detail: 'soil', soil: { textura: 'argiloso', source: 'map' } })

      const dialog = screen.getByRole('dialog', { name: 'Do que a sua terra é feita' })
      const choose = within(dialog).getByRole('group', { name: 'Sua terra é diferente?' })
      expect(within(choose).getAllByRole('button').map((button) => button.textContent)).toEqual(['Arenosa', 'Média', 'Argilosa'])
      expect(within(choose).getByRole('button', { name: 'Argilosa' })).toHaveAttribute('aria-pressed', 'true')
      await userEvent.click(within(choose).getByRole('button', { name: 'Arenosa' }))
      expect(props.onChooseSoil).toHaveBeenCalledWith('arenoso')
    })

    it('fechar o modal pede para fechar', async () => {
      const props = setup({ detail: 'heat' })

      await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
      expect(props.onCloseDetail).toHaveBeenCalled()
    })

    it('sem o raio-X, o painel não aparece e a terra fica num cartão claro, com a troca', async () => {
      const props = setup({ xray: null, soil: { textura: 'argiloso', source: 'map' } })

      expect(screen.queryByRole('region', { name: /Lavoura de demonstração/ })).not.toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Terra argilosa' })).toBeInTheDocument()
      await userEvent.click(within(screen.getByRole('group', { name: 'Sua terra é diferente?' })).getByRole('button', { name: 'Média' }))
      expect(props.onChooseSoil).toHaveBeenCalledWith('medio')
    })
  })

  describe('suas últimas safras', () => {
    it('com NDVI: o título, desde quando o satélite olha e o que ele viu da soja', () => {
      setup()

      const section = screen.getByRole('region', { name: 'Suas últimas safras' })
      expect(within(section).getByText('O que o satélite viu na sua área desde a safra 2016/17, e o que você confirmou.')).toBeInTheDocument()
      expect(within(section).getByText('O satélite viu a soja nas 3 últimas safras')).toBeInTheDocument()
    })

    it('o gráfico: todas as safras com leitura, a safra atual tracejada e o título contado pelas respostas', () => {
      const chart = seasonChart({
        strip: RAIO.historico_ndvi,
        historico,
        answers: { 2024: 'milho_braquiaria', 2025: 'milho_safrinha', 2026: 'pousio' },
        current: 'milho_safrinha',
      })
      setup({ chart })

      const figure = screen.getByRole('figure', { name: 'Na entressafra, sua área ficou parada em 1 de 10 safras' })
      const rows = within(figure).getAllByRole('listitem').filter((item) => item.hasAttribute('data-tone'))
      expect(rows).toHaveLength(11)
      expect(rows[0]).toHaveTextContent('2016/17jan–jul 2017satélite: plantou')
      expect(rows[7]).toHaveTextContent('2023/24jan–jul 2024Milho com braquiária')
      expect(rows[9]).toHaveTextContent('Deixei parado')
      expect(rows[10]).toHaveTextContent('2026/27jan–jul 2027pensa em milho sozinho')
      expect(within(figure).getByText('MODIS NDVI · NASA · 250 m')).toBeInTheDocument()
    })

    it('safra atual sem escolha: "a planejar"; "Ainda não sei": "ainda não sabe"', () => {
      setup()
      expect(screen.getByRole('figure')).toHaveTextContent('2026/27jan–jul 2027a planejar')
    })

    it('sem NDVI: só as 3 últimas, listradas, e os textos de "marque você"', () => {
      setup({ chart: NO_READING_CHART, seasons: NO_READING })

      const section = screen.getByRole('region', { name: 'Suas últimas safras' })
      expect(within(section).getByText('Marque o que você fez nas últimas 3 safras e o que pensa plantar nesta.')).toBeInTheDocument()
      expect(within(section).getByText('Sem leitura do satélite neste ponto: marque você')).toBeInTheDocument()
      const figure = within(section).getByRole('figure', { name: 'As últimas safras, pelo que você marcar' })
      expect(within(figure).getAllByRole('listitem').filter((item) => item.hasAttribute('data-tone'))).toHaveLength(4)
      expect(within(figure).getAllByText('Falta confirmar')).toHaveLength(3)
      expect(within(figure).getByText('sem leitura do satélite')).toBeInTheDocument()
      expect(within(section).getByText('Sem leitura do satélite neste ponto, o que vale é a sua resposta.')).toBeInTheDocument()
    })

    it('confirmações: o formulário das 3 safras e a safra atual, com a data da colheita e o "Trocar data"', async () => {
      const props = setup()

      expect(screen.getByRole('heading', { level: 3, name: 'Confirme as últimas safras' })).toBeInTheDocument()
      expect(screen.getByText('O satélite vê que houve plantio, mas não qual planta. Sua resposta vale no lugar dele.')).toBeInTheDocument()
      expect(screen.getByText('colheita prevista em 3 de março de 2027')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Trocar data' })).toHaveAttribute('href', props.seasons.current.changeDateTo)

      await userEvent.click(within(screen.getByRole('group', { name: 'Depois da soja na safra 2023/24' })).getByRole('button', { name: 'Sorgo' }))
      expect(props.onAnswerSeason).toHaveBeenCalledWith(2024, 'sorgo')
      await userEvent.click(
        within(screen.getByRole('group', { name: 'O que você pensa plantar depois da soja 2026/27' })).getByRole('button', { name: 'Milheto' }),
      )
      expect(props.onChooseCurrent).toHaveBeenCalledWith('milheto')
    })

    it('rodapé: para que servem as respostas e o "Saiba mais: rotação de culturas" em nova aba', () => {
      setup()

      expect(screen.getByText('Usamos essas respostas para comparar o seu plano com “como é hoje”.')).toBeInTheDocument()
      const link = screen.getByRole('link', { name: /Saiba mais: rotação de culturas/ })
      expect(link).toHaveAttribute('href', '/guia/rotacao-de-culturas')
      expect(link).toHaveAttribute('target', '_blank')
    })

    it('ponto sem soja: avisa e oferece ajustar no mapa', () => {
      const props = setup({ noSoy: true })

      expect(screen.getByText('Não parece uma lavoura de soja. Confira o ponto no mapa.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Ajustar no mapa' })).toHaveAttribute('href', props.adjustTo)
    })

    it('com safras respondidas fora da demonstração, oferece compartilhar com a comunidade', () => {
      setup({
        share: {
          state: { open: false, showNotice: false, rows: [] },
          communityTo: '/comunidade',
          onToggle: vi.fn(),
          onChange: vi.fn(),
          onSend: vi.fn(),
        },
      })

      expect(screen.getByRole('button', { name: 'Compartilhar com a comunidade' })).toBeInTheDocument()
    })
  })

  describe('ação', () => {
    it('"Ver o que plantar" com o que falta: nada é obrigatório', async () => {
      const props = setup()

      expect(screen.getByText('Faltam 3 safras. Pode seguir: sem resposta, usamos o que o satélite viu.')).toBeInTheDocument()
      expect(screen.getByText('0 de 3 safras confirmadas')).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Ver o que plantar' }))
      expect(props.onConfirm).toHaveBeenCalled()
    })

    it('falta 1, sem satélite, e tudo confirmado', () => {
      setup({ seasons: { ...NO_READING, answered: 2 }, chart: NO_READING_CHART })
      expect(screen.getByText('Falta 1 safra. Pode seguir: sem resposta, o plano não compara com “como é hoje”.')).toBeInTheDocument()
    })

    it('tudo confirmado', () => {
      setup({ seasons: { ...SEASONS, answered: 3 } })
      expect(screen.getByText('Últimas safras confirmadas.')).toBeInTheDocument()
      expect(screen.getByText('3 safras confirmadas')).toBeInTheDocument()
    })
  })

  it('carregando, erro e fora da área', () => {
    const { unmount } = render(
      <MemoryRouter>
        <SatelliteView {...setupProps({ status: 'loading' })} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Buscando dados do satélite…')).toBeInTheDocument()
    unmount()
    render(
      <MemoryRouter>
        <SatelliteView {...setupProps({ status: 'outside' })} />
      </MemoryRouter>,
    )
    expect(screen.queryByRole('region', { name: 'Suas últimas safras' })).not.toBeInTheDocument()
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en', xray: { ...XRAY, demo: false } })

    expect(screen.getByRole('heading', { level: 1, name: 'Done. The satellite saw the rest.' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Near Uberlândia (MG)' })).toBeInTheDocument()
    expect(screen.getByText('-18.9543 · -48.1993')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Your last seasons' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'See what to plant' })).toBeInTheDocument()
  })
})

function setupProps(overrides: Partial<SatelliteViewProps>): SatelliteViewProps {
  return {
    t: pt,
    lang: 'pt',
    backTo: '/quando',
    status: 'ready',
    onRetry: vi.fn(),
    listen: { supported: false, speaking: false, toggle: vi.fn() },
    xray: null,
    detail: null,
    onOpenDetail: vi.fn(),
    onCloseDetail: vi.fn(),
    soil: { textura: 'medio', source: 'map' },
    onChooseSoil: vi.fn(),
    chart: NO_READING_CHART,
    seasons: NO_READING,
    onAnswerSeason: vi.fn(),
    onChooseCurrent: vi.fn(),
    noSoy: false,
    adjustTo: '/onde',
    share: null,
    onConfirm: vi.fn(),
    ...overrides,
  }
}
