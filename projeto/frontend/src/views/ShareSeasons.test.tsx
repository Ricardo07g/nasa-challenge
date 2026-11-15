import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { SeasonShare } from '../controllers/useSatelliteController'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import { ShareSeasons, type ShareSeasonsProps } from './ShareSeasons'

const STATE: SeasonShare = {
  open: true,
  showNotice: true,
  rows: [
    { year: 2024, idle: false, draft: { crop: null, year: 2024, outcome: null, reason: null }, ready: false, status: null },
    { year: 2025, idle: true, draft: { crop: 'pousio', year: 2025, outcome: null, reason: null }, ready: true, status: null },
  ],
}

function setup(state: Partial<SeasonShare> = {}, overrides: Partial<ShareSeasonsProps> = {}) {
  const props: ShareSeasonsProps = {
    t: pt,
    state: { ...STATE, ...state },
    communityTo: '/comunidade?lat=-18.9543&lon=-48.1993&colheita=meio',
    onToggle: vi.fn(),
    onChange: vi.fn(),
    onSend: vi.fn(),
    ...overrides,
  }
  render(
    <MemoryRouter>
      <ShareSeasons {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('ShareSeasons ("Compartilhar com a comunidade" na tela 4, tarefa 0047)', () => {
  it('fechado: só o botão, que abre o painel', async () => {
    const props = setup({ open: false })

    const button = screen.getByRole('button', { name: 'Compartilhar com a comunidade' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Safra 2024')).not.toBeInTheDocument()
    await userEvent.click(button)
    expect(props.onToggle).toHaveBeenCalled()
  })

  it('aberto: uma linha por safra confirmada e o aviso de privacidade antes do primeiro envio', () => {
    setup()

    expect(screen.getByRole('button', { name: 'Compartilhar com a comunidade' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Seus vizinhos veem a região, não o seu ponto.')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Safra 2024' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Safra 2025' })).toBeInTheDocument()
  })

  it('"Plantei": pergunta a cultura (sem "Deixei parado") e como foi', async () => {
    const props = setup()

    const season = screen.getByRole('group', { name: 'Safra 2024' })
    const crops = within(season).getByRole('group', { name: 'O que você plantou?' })
    expect(within(crops).queryByRole('button', { name: 'Deixei parado' })).not.toBeInTheDocument()
    expect(within(crops).getAllByRole('button')).toHaveLength(6)
    await userEvent.click(within(crops).getByRole('button', { name: 'Sorgo' }))
    expect(props.onChange).toHaveBeenCalledWith(2024, { crop: 'sorgo' })
    expect(within(season).getByRole('group', { name: 'Como foi?' })).toBeInTheDocument()
    expect(within(season).getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })

  it('"Deixei parado": já pronto, só enviar', async () => {
    const props = setup()

    const season = screen.getByRole('group', { name: 'Safra 2025' })
    expect(season).toHaveTextContent('Deixei parado')
    expect(within(season).queryByRole('group', { name: 'Como foi?' })).not.toBeInTheDocument()
    await userEvent.click(within(season).getByRole('button', { name: 'Enviar' }))
    expect(props.onSend).toHaveBeenCalledWith(2025)
  })

  it('compartilhado: agradece e leva para a comunidade', () => {
    setup({
      showNotice: false,
      rows: [{ ...STATE.rows[1], status: 'sent' }],
    })

    expect(screen.getByRole('status')).toHaveTextContent('Compartilhado. Obrigado!')
    expect(screen.getByRole('link', { name: 'Ver o que os vizinhos contam' })).toHaveAttribute(
      'href',
      '/comunidade?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
    expect(screen.queryByText('Seus vizinhos veem a região, não o seu ponto.')).not.toBeInTheDocument()
  })

  it('falhou: diz o motivo na linha', () => {
    setup({ rows: [{ ...STATE.rows[1], status: 'limit' }] })

    expect(screen.getByRole('alert')).toHaveTextContent('Você já mandou 10 relatos hoje. Tente de novo amanhã.')
  })

  it('em inglês', () => {
    setup({}, { t: en })

    expect(screen.getByRole('button', { name: 'Share with the community' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '2025 season' })).toHaveTextContent('Left it idle')
  })
})
