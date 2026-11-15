import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { CropId, Recomendacao } from '../models/recomendacao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { compareChips, comparedCrops } from '../services/compareService'
import { findOption } from '../services/recomendacaoRules'
import { buildSuggestion } from '../services/suggestionService'
import { OptionsView, type CompareState, type OptionsViewProps } from './OptionsView'

const point = { lat: -18.9543, lon: -48.1993 }
const nav = {
  label: 'Telas da resposta',
  backTo: '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
  tabs: [
    { to: '/resposta', label: 'Sugestão', current: false },
    { to: '/opcoes', label: 'Comparar', current: true },
    { to: '/plano', label: 'Plano de 3 anos', current: false },
  ],
  objective: null,
  chooseObjective: vi.fn(),
}

function state(rec: Recomendacao, fromUrl?: CropId[]): CompareState {
  const selected = comparedCrops(rec, null, fromUrl)
  return {
    chips: compareChips(rec, null, selected),
    columns: selected.flatMap((crop) => findOption(rec.opcoes, crop) ?? []),
    selected,
    best: 'milho_braquiaria',
    full: selected.length >= 3,
    alternatives: buildSuggestion(rec, null)?.alternatives ?? [],
  }
}

const meio = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')

function setup(overrides: Partial<OptionsViewProps> = {}) {
  const props: OptionsViewProps = {
    t: pt,
    lang: 'pt',
    nav,
    status: 'ready',
    onRetry: vi.fn(),
    compare: state(meio),
    onToggle: vi.fn(),
    onCompareWith: vi.fn(),
    planLink: (crop) => `/plano?plano=${crop}`,
    ...overrides,
  }
  render(
    <MemoryRouter>
      <OptionsView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('OptionsView (aba Comparar, tarefa 0045)', () => {
  it('as culturas escolhidas lado a lado, com as linhas do pedido', () => {
    setup()

    expect(screen.getByRole('heading', { level: 1, name: 'Comparar' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: /Lado a lado: Milho com braquiária, Sorgo e Milho sozinho/ })
    for (const name of ['Milho com braquiária', 'Sorgo', 'Milho sozinho']) {
      expect(within(table).getByRole('columnheader', { name: new RegExp(name) })).toBeInTheDocument()
    }
    for (const row of [
      'Deu certo',
      'Por que falhou',
      'Água',
      'Clima 2041–2060',
      'Renda',
      'Terra',
      'Prazo para plantar',
      'Por que usar',
      'Por que evitar',
    ]) {
      expect(within(table).getByRole('columnheader', { name: row })).toBeInTheDocument()
    }
    expect(within(table).getAllByText('14 de 20 anos')).toHaveLength(2) // milho com braquiária e milho sozinho
    expect(within(table).getByText('17 de 20 anos')).toBeInTheDocument()
    expect(within(table).getAllByText('Até 28 de fevereiro').length).toBeGreaterThan(0)
    expect(within(table).getByText('Ajuda pouco a terra.')).toBeInTheDocument()
  })

  it('a linha Água em três números curtos e a falta do ano seco', () => {
    setup()

    const table = screen.getByRole('table')
    expect(within(table).getAllByText('Precisa de 346 mm').length).toBeGreaterThan(0)
    expect(within(table).getAllByText('Falta 116 mm (ano seco: 158 mm)').length).toBeGreaterThan(0)
  })

  it('"Saiba mais" para o artigo de cada cultura e "Usar no meu plano" leva ao Plano', () => {
    setup()

    expect(screen.getByRole('link', { name: 'Saiba mais: Sorgo' })).toHaveAttribute('href', '/guia/sorgo')
    expect(screen.getByRole('link', { name: 'Usar Sorgo no ano 1 do meu plano' })).toHaveAttribute('href', '/plano?plano=sorgo')
  })

  it('chips com a imagem e o selo de sede; tocar avisa a cultura', async () => {
    const props = setup({ compare: state(meio, ['sorgo']) })

    const group = screen.getByRole('group', { name: 'Culturas para comparar' })
    expect(within(group).getByRole('button', { name: /Sorgo/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getAllByRole('img').length).toBeGreaterThan(0)
    await userEvent.click(within(group).getByRole('button', { name: /Crotalária/ }))
    expect(props.onToggle).toHaveBeenCalledWith('crotalaria')
  })

  it('cultura fora da janela: chip desligado com o motivo', () => {
    const tarde = buildRecomendacao({ ...point, colheita: 'tarde' }, 'pt')
    setup({ compare: state(tarde) })

    const late = screen.getByRole('button', { name: /Milho sozinho/ })
    expect(late).toBeDisabled()
    expect(late).toHaveTextContent('Passou do prazo (28 de fevereiro)')
  })

  it('"Se você prefere…" é o ponto de partida: cada cartão compara com a sugestão', async () => {
    const props = setup()

    const prefer = screen.getByRole('region', { name: 'Se você prefere…' })
    await userEvent.click(within(prefer).getByRole('button', { name: 'Comparar Crotalária com a sugestão' }))
    expect(props.onCompareWith).toHaveBeenCalledWith('crotalaria')
  })

  it('a linha Terra liga aos artigos de palhada, adubo verde e nematoide', () => {
    setup()

    expect(screen.getByRole('link', { name: 'Palhada' })).toHaveAttribute('href', '/guia/palhada')
    expect(screen.getByRole('link', { name: 'Adubo verde' })).toHaveAttribute('href', '/guia/adubo-verde')
    expect(screen.getByRole('link', { name: 'Nematoide' })).toHaveAttribute('href', '/guia/nematoide')
  })

  it('nenhum valor em reais', () => {
    setup()

    expect(document.body.textContent).not.toMatch(/R\$/)
  })

  it('em inglês', () => {
    const rec = buildRecomendacao({ ...point, colheita: 'meio' }, 'en')
    setup({ t: en, lang: 'en', compare: state(rec) })

    expect(screen.getByRole('table', { name: /Side by side/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Use Sorghum in year 1 of my plan' })).toBeInTheDocument()
  })

  it('carregando e fora da área não mostram a tabela', () => {
    setup({ status: 'outside', compare: null })

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
