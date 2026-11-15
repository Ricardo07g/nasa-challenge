import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { SeasonAnswers, SeasonRow } from '../models/seasonAnswers'
import { SeasonAnswersForm, type SeasonAnswersFormProps } from './SeasonAnswersForm'

const SEASONS: SeasonRow[] = [
  { year: 2024, satellite: { soy: true, after: 'plantou', ndvi: 0.71 } },
  { year: 2025, satellite: { soy: true, after: 'parado', ndvi: 0.32 } },
  { year: 2026, satellite: null },
]

const wrap = (node: ReactNode) => <MemoryRouter>{node}</MemoryRouter>

function setup(overrides: Partial<SeasonAnswersFormProps> = {}) {
  const onAnswer = vi.fn()
  const onChoose = vi.fn()
  const props: SeasonAnswersFormProps = {
    t: pt,
    lang: 'pt',
    seasons: SEASONS,
    answers: {},
    onAnswer,
    current: { choice: undefined, onChoose, harvestDate: '2027-03-03', changeDateTo: '/quando?lat=1&lon=2' },
    ...overrides,
  }
  const view = render(wrap(<SeasonAnswersForm {...props} />))
  return { onAnswer, onChoose, props, rerender: (next: Partial<SeasonAnswersFormProps>) => view.rerender(wrap(<SeasonAnswersForm {...props} {...next} />)) }
}

const group = (name: string) => screen.getByRole('group', { name })

describe('SeasonAnswersForm ("Confirme as últimas safras", telas 4 e 5)', () => {
  it('uma linha por safra passada, nomeada pela safra, com o período da soja e do depois', () => {
    setup()

    for (const season of ['2023/24', '2024/25', '2025/26']) {
      expect(group(`Soja na safra ${season}`)).toBeInTheDocument()
      expect(group(`Depois da soja na safra ${season}`)).toBeInTheDocument()
    }
    expect(screen.getByText('plantada no fim de 2023, colhida no começo de 2024')).toBeInTheDocument()
    expect(screen.getByText('de março a julho de 2024: o que você plantou')).toBeInTheDocument()
  })

  it('"Plantei / Não plantei" e as 6 opções do depois, na ordem do protótipo', () => {
    setup()

    const soy = within(group('Soja na safra 2023/24')).getAllByRole('button').map((b) => b.textContent)
    const after = within(group('Depois da soja na safra 2023/24')).getAllByRole('button').map((b) => b.textContent)
    expect(soy).toEqual(['Plantei', 'Não plantei'])
    expect(after).toEqual(['Milho sozinho', 'Milho com braquiária', 'Sorgo', 'Milheto', 'Crotalária', 'Deixei parado'])
  })

  it('quando o satélite viu a soja, "Plantei" já vem marcado, com a dica do que ele viu depois', () => {
    setup()

    expect(within(group('Soja na safra 2023/24')).getByRole('button', { name: 'Plantei' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('satélite viu plantio · verde 0,71')).toBeInTheDocument()
    expect(screen.getByText('satélite viu a terra parada · verde 0,32')).toBeInTheDocument()
    // Sem leitura do satélite: nada marcado e sem dica.
    expect(within(group('Soja na safra 2025/26')).getByRole('button', { name: 'Plantei' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('devolve a mudança de cada pergunta (componente controlado)', async () => {
    const { onAnswer } = setup({ answers: { 2025: 'sorgo' } })

    await userEvent.click(within(group('Depois da soja na safra 2023/24')).getByRole('button', { name: 'Milho com braquiária' }))
    expect(onAnswer).toHaveBeenLastCalledWith(2024, 'milho_braquiaria')

    await userEvent.click(within(group('Soja na safra 2025/26')).getByRole('button', { name: 'Não plantei' }))
    expect(onAnswer).toHaveBeenLastCalledWith(2026, 'sem_soja')

    // Tocar de novo na cultura marcada tira só o depois (a soja continua plantada).
    await userEvent.click(within(group('Depois da soja na safra 2024/25')).getByRole('button', { name: 'Sorgo' }))
    expect(onAnswer).toHaveBeenLastCalledWith(2025, 'soja')
  })

  it('mostra as respostas recebidas; com "Não plantei", o depois fica desligado', () => {
    const answers: SeasonAnswers = { 2024: 'pousio', 2026: 'sem_soja' }
    setup({ answers })

    expect(within(group('Depois da soja na safra 2023/24')).getByRole('button', { name: 'Deixei parado' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(group('Soja na safra 2025/26')).getByRole('button', { name: 'Não plantei' })).toHaveAttribute('aria-pressed', 'true')
    for (const button of within(group('Depois da soja na safra 2025/26')).getAllByRole('button')) expect(button).toBeDisabled()
    expect(screen.getByText('Sem soja nessa safra: não há o que marcar aqui.')).toBeInTheDocument()
  })

  it('trocar a resposta não remonta os botões (a tela não pula)', () => {
    const { rerender } = setup()
    const before = within(group('Depois da soja na safra 2023/24')).getByRole('button', { name: 'Sorgo' })

    rerender({ answers: { 2024: 'sorgo' } })

    const after = within(group('Depois da soja na safra 2023/24')).getByRole('button', { name: 'Sorgo' })
    expect(after).toBe(before)
    expect(after).toHaveAttribute('aria-pressed', 'true')
  })

  it('a safra atual 2026/27 não pergunta a soja: mostra a colheita prevista e o "Trocar data"', () => {
    setup()

    expect(screen.getByText('2026/27')).toBeInTheDocument()
    expect(screen.getByText('safra atual')).toBeInTheDocument()
    expect(screen.getByText('Soja plantada')).toBeInTheDocument()
    expect(screen.getByText('colheita prevista em 3 de março de 2027')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Trocar data' })).toHaveAttribute('href', '/quando?lat=1&lon=2')
    expect(screen.queryByRole('group', { name: 'Soja na safra 2026/27' })).not.toBeInTheDocument()
  })

  it('na safra atual, "o que você pensa plantar": 6 opções (com "Deixar parado") e "Ainda não sei"', async () => {
    const { onChoose, rerender } = setup()

    expect(screen.getByText('depois de colher (3 de março) até julho de 2027: o que você pensa plantar')).toBeInTheDocument()
    const options = within(group('O que você pensa plantar depois da soja 2026/27')).getAllByRole('button')
    expect(options.map((b) => b.textContent)).toEqual([
      'Milho sozinho',
      'Milho com braquiária',
      'Sorgo',
      'Milheto',
      'Crotalária',
      'Deixar parado',
      'Ainda não sei',
    ])

    await userEvent.click(screen.getByRole('button', { name: 'Ainda não sei' }))
    expect(onChoose).toHaveBeenLastCalledWith('nao_sei')

    rerender({ current: { choice: 'sorgo', onChoose } })
    const sorghum = within(group('O que você pensa plantar depois da soja 2026/27')).getByRole('button', { name: 'Sorgo' })
    expect(sorghum).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(sorghum)
    expect(onChoose).toHaveBeenLastCalledWith(null)
  })

  it('sem a data da tela 2, diz só o começo de 2027; sem o link, não mostra o "Trocar data"', () => {
    setup({ current: { choice: undefined, onChoose: vi.fn() } })

    expect(screen.getByText('colheita prevista no começo de 2027')).toBeInTheDocument()
    expect(screen.getByText('depois de colher até julho de 2027: o que você pensa plantar')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Trocar data' })).not.toBeInTheDocument()
  })

  it('sem a data, mas com a época da tela 2 (`colheita`), diz a época com o texto da tela 2', () => {
    const { rerender } = setup({ current: { choice: undefined, onChoose: vi.fn(), harvestBand: 'meio' } })

    expect(screen.getByText('colheita prevista no meio de fevereiro')).toBeInTheDocument()
    expect(screen.queryByText('colheita prevista no começo de 2027')).not.toBeInTheDocument()

    rerender({ current: { choice: undefined, onChoose: vi.fn(), harvestBand: 'cedo' } })
    expect(screen.getByText('colheita prevista no começo de fevereiro')).toBeInTheDocument()

    rerender({ current: { choice: undefined, onChoose: vi.fn(), harvestBand: 'tarde' } })
    expect(screen.getByText('colheita prevista no fim de fevereiro ou em março')).toBeInTheDocument()
  })

  it('com a data e a época, vale a data (como hoje)', () => {
    setup({ current: { choice: undefined, onChoose: vi.fn(), harvestDate: '2027-03-03', harvestBand: 'tarde' } })

    expect(screen.getByText('colheita prevista em 3 de março de 2027')).toBeInTheDocument()
    expect(screen.queryByText('colheita prevista no fim de fevereiro ou em março')).not.toBeInTheDocument()
  })

  it('sem a safra atual (current ausente), só as safras passadas', () => {
    setup({ current: undefined })

    expect(screen.queryByText('2026/27')).not.toBeInTheDocument()
    expect(screen.getAllByRole('group')).toHaveLength(6)
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en' })

    expect(group('Soybeans in the 2023/24 season')).toBeInTheDocument()
    expect(screen.getByText('planted in late 2023, harvested in early 2024')).toBeInTheDocument()
    expect(screen.getByText('March to July 2024: what you planted')).toBeInTheDocument()
    expect(screen.getByText('satellite saw planting · green 0.71')).toBeInTheDocument()
    expect(screen.getByText('harvest expected on March 3, 2027')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not sure yet' })).toBeInTheDocument()
  })

  it('em inglês, só com a época da colheita', () => {
    setup({ t: en, lang: 'en', current: { choice: undefined, onChoose: vi.fn(), harvestBand: 'meio' } })

    expect(screen.getByText('harvest expected in mid-February')).toBeInTheDocument()
  })
})
