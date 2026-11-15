import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { PlanoAvaliado } from '../models/plano'
import type { CropId, SinalOutono } from '../models/recomendacao'
import { buildRecomendacao, buildTalhao } from '../repositories/mocks/fixtures'
import { buildPlano } from '../repositories/mocks/mockPlano'
import { planChoices, todayRows } from '../services/planService'
import { thirstByCrop } from '../services/suggestionService'
import { PlanView, type PlanViewProps } from './PlanView'

const point = { lat: -18.9543, lon: -48.1993 }
const rec = buildRecomendacao({ ...point, colheita: 'meio' }, 'pt')
const field = buildTalhao(point, 'pt')
const PLAN: CropId[] = ['milho_braquiaria', 'crotalaria', 'sorgo']
const TODAY: CropId[] = ['milho_safrinha', 'pousio', 'milho_safrinha']

/** Sinal de teste no formato da API (tarefa 0038): textos e números de teste. */
const testSignal: SinalOutono = {
  nivel: 'normal',
  motivo: 'Previsão de teste: El Niño (70%, Fonte de teste).',
  fonte: ['Fonte de teste'],
  data: '2026-11-14',
}

const nav = {
  label: 'Telas da resposta',
  backTo: '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
  tabs: [
    { to: '/resposta', label: 'Sugestão', current: false },
    { to: '/opcoes', label: 'Comparar', current: false },
    { to: '/plano', label: 'Plano de 3 anos', current: true },
  ],
  objective: null,
  chooseObjective: vi.fn(),
}

/** Avaliação de teste no formato da API (números de teste, não são de fonte real). */
function evaluation(anos: CropId[], over: Partial<PlanoAvaliado> = {}): PlanoAvaliado {
  return { ...buildPlano({ ...point, colheita: 'meio', anos }, 'pt'), ...over }
}

function setup(overrides: Partial<PlanViewProps> = {}) {
  const props: PlanViewProps = {
    t: pt,
    lang: 'pt',
    nav,
    status: 'ready',
    onRetry: vi.fn(),
    signal: null,
    plan: {
      years: PLAN.map((crop, index) => ({ year: 2027 + index, crop })),
      choices: planChoices(rec, null),
      edited: false,
      thirst: thirstByCrop(rec),
      options: rec.opcoes,
    },
    evaluation: { data: evaluation(PLAN), status: 'ready' },
    today: {
      rows: todayRows(field.historico, field.anos_confirmaveis, {}, {}),
      hasSatellite: true,
      crops: TODAY,
      reference: true,
      referenceText: 'Referência de teste.',
      evaluation: { data: evaluation(TODAY), status: 'ready' },
    },
    onChooseCrop: vi.fn(),
    onReset: vi.fn(),
    onAnswerToday: vi.fn(),
    communityTo: '/comunidade',
    ...overrides,
  }
  render(
    <MemoryRouter>
      <PlanView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('PlanView (aba Plano de 3 anos, tarefa 0045)', () => {
  it('um ano por cartão, com a imagem, o selo de sede e a escolha da cultura', async () => {
    const props = setup()

    const years = screen.getByRole('list', { name: 'Seu plano ano a ano' })
    expect(within(years).getAllByRole('listitem')).toHaveLength(3)
    expect(years).toHaveTextContent('2027Milho com braquiária')
    expect(within(years).getByText('Sede: muita água')).toBeInTheDocument()
    expect(within(years).getByText('Deu certo em 14 de 20 anos')).toBeInTheDocument()

    const select = screen.getByRole('combobox', { name: 'O que plantar em 2028' })
    expect(within(select).getAllByRole('option').map((option) => option.textContent)).toContain('Deixar parado')
    await userEvent.selectOptions(select, 'milheto')
    expect(props.onChooseCrop).toHaveBeenCalledWith(1, 'milheto')
  })

  it('o título liga ao artigo "Rotação de culturas"', () => {
    setup()

    expect(screen.getByRole('link', { name: 'Saiba mais: Rotação de culturas' })).toHaveAttribute('href', '/guia/rotacao-de-culturas')
  })

  it('"Voltar ao plano sugerido" só com o plano mudado', async () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Voltar ao plano sugerido' })).not.toBeInTheDocument()
    expect(screen.getByText('Este é o plano sugerido para o que você quer mais.')).toBeInTheDocument()
  })

  it('com o plano mudado, o botão volta ao sugerido', async () => {
    const props = setup({ plan: { ...setupPlan(), edited: true } })

    await userEvent.click(screen.getByRole('button', { name: 'Voltar ao plano sugerido' }))
    expect(props.onReset).toHaveBeenCalled()
  })

  it('as notas do plano ao lado do "Como é hoje": segurança, saúde da terra e clima 2041–2060', () => {
    setup({
      evaluation: { data: evaluation(PLAN, { notas: { seguranca: 85, solo: 71.7, futuro: 80 } }), status: 'ready' },
    })

    const table = screen.getByRole('table', { name: 'Notas do seu plano ao lado de como é hoje' })
    expect(within(table).getByRole('columnheader', { name: 'Seu plano' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Como é hoje' })).toBeInTheDocument()
    for (const row of ['Segurança climática', 'Saúde da terra', 'Clima 2041–2060']) {
      expect(within(table).getByRole('columnheader', { name: row })).toBeInTheDocument()
    }
    expect(within(table).getByText('85 de 100')).toBeInTheDocument()
    expect(within(table).getByText('72 de 100')).toBeInTheDocument()
  })

  it('enquanto recalcula, as notas anteriores ficam e o aviso aparece', () => {
    setup({ evaluation: { data: evaluation(PLAN), status: 'loading' } })

    expect(screen.getByRole('status')).toHaveTextContent('Recalculando…')
    expect(screen.getByRole('table', { name: 'Notas do seu plano ao lado de como é hoje' })).toBeInTheDocument()
  })

  it('saúde da terra com fatos: anos cobertos, nitrogênio, nematoide e repetição', () => {
    setup({
      evaluation: {
        data: evaluation(PLAN, {
          terra: { anos_cobertos: 3, anos_nitrogenio: 1, anos_nematoide: 1, repetidas: ['milho_braquiaria'], total: 3, bonus_diversidade: 10 },
        }),
        status: 'ready',
      },
    })

    const soil = screen.getByRole('region', { name: 'Saúde da terra na rotação' })
    expect(soil).toHaveTextContent('Terra coberta nos 3 anos')
    expect(soil).toHaveTextContent('1 ano deixa nitrogênio na terra')
    expect(soil).toHaveTextContent('1 ano quebra o ciclo do nematoide')
    expect(soil).toHaveTextContent('Repete a mesma cultura: milho com braquiária')
    expect(soil).toHaveTextContent('soma 10 pontos')
  })

  it('chuva aproveitada: a frase do pedido, cada ano e o "Como é hoje", com a fonte', () => {
    setup({
      evaluation: {
        data: evaluation(['milho_braquiaria', 'pousio', 'crotalaria'], {
          chuva: { inicio: '2027-02-18', fim: '07-31', chuva_mm: 413, usa_media_mm: 143, anos: 20, fonte: 'gpm_imerg' },
        }),
        status: 'ready',
      },
      plan: { ...setupPlan(['milho_braquiaria', 'pousio', 'crotalaria']) },
    })

    const rain = screen.getByRole('region', { name: 'Chuva aproveitada' })
    expect(rain).toHaveTextContent(
      'Com a terra parada, 413 mm de chuva por ano caem sem virar grão nem palha. Com o plano, a lavoura usa 143 mm.',
    )
    expect(rain).toHaveTextContent('2028, deixar parado: 413 mm caem sem cultura')
    expect(rain).toHaveTextContent('Chuva do GPM IMERG de 18 de fevereiro')
    expect(within(rain).getByRole('link', { name: 'Saiba mais: A conta de água da lavoura' })).toHaveAttribute('href', '/guia/conta-de-agua')
  })

  it('com a terra parada nos 3 anos de hoje, a chuva aproveitada não diz que a lavoura usa 0 mm', () => {
    const fallow: CropId[] = ['pousio', 'pousio', 'pousio']
    setup({ today: { ...setupToday(), crops: fallow, evaluation: { data: evaluation(fallow), status: 'ready' } } })

    expect(screen.getByRole('region', { name: 'Chuva aproveitada' })).not.toHaveTextContent('Como é hoje, a lavoura usa')
  })

  it('sem Plano B (a cultura nunca falhou), sem a linha da fonte do limite', () => {
    const base = evaluation(PLAN)
    setup({
      evaluation: {
        data: { ...base, plano_ab: { ...base.plano_ab!, cultura_b: null, nome_b: null, b_bons_nas_falhas: null, limite: null, falhas_a: 0, motivo: 'nunca_falhou' } },
        status: 'ready',
      },
    })

    const ab = screen.getByRole('region', { name: 'Plano A e Plano B' })
    expect(ab).toHaveTextContent('Não precisou de Plano B: milho com braquiária deu certo nos 20 anos.')
    expect(ab).not.toHaveTextContent('no seu ponto')
  })

  it('Plano A e Plano B numa frase cada; sem limite que separe, o Plano B vem sem número', () => {
    setup()

    const ab = screen.getByRole('region', { name: 'Plano A e Plano B' })
    expect(ab).toHaveTextContent('Plano A: milho com braquiária, se a chuva vier normal.')
    expect(ab).toHaveTextContent('Plano B: crotalária, se secar.')
    expect(ab).toHaveTextContent('Não damos um número para "secar"')
    expect(ab).not.toHaveTextContent('mm no pluviômetro')
    expect(within(ab).getByRole('link', { name: 'Saiba mais: Veranico' })).toHaveAttribute('href', '/guia/veranico')
  })

  it('com um limite que separa bem, o Plano B traz o número do pluviômetro', () => {
    const base = evaluation(PLAN)
    setup({
      evaluation: {
        data: {
          ...base,
          plano_ab: {
            ...base.plano_ab!,
            falhas_a: 4,
            limite: { dias: 15, chuva_mm: 42, anos_marcados: 3, falhas_marcadas: 3, falhas: 4, total: 20, chance_pct: 0.3, separa: true, motivo: null },
          },
        },
        status: 'ready',
      },
    })

    const ab = screen.getByRole('region', { name: 'Plano A e Plano B' })
    expect(ab).toHaveTextContent('Secar = menos de 42 mm no pluviômetro nos 15 dias antes de plantar.')
    expect(ab).toHaveTextContent('esse limite pegou 3 dos 4 anos')
  })

  it('"Como é hoje": o que o satélite viu nas 3 últimas safras e a pergunta "O que foi?"', async () => {
    const props = setup()

    const today = screen.getByRole('region', { name: 'Como é hoje' })
    expect(today).toHaveTextContent('O satélite viu plantio na entressafra de 2026. O que foi?')
    expect(today).toHaveTextContent('o satélite viu a terra parada')
    expect(today).toHaveTextContent('verde máximo 0,71 (MODIS)')
    expect(today).toHaveTextContent('Enquanto você não conta as 3 safras, "Como é hoje" é uma referência. Referência de teste.')
    const question = within(today).getByRole('group', { name: 'O que foi em 2026?' })
    await userEvent.click(within(question).getByRole('button', { name: 'Sorgo' }))
    expect(props.onAnswerToday).toHaveBeenCalledWith(2026, 'sorgo')
  })

  it('"Como é hoje" com a mesma cultura nos 3 anos diz "nos 3 anos"', () => {
    const crops: CropId[] = ['milho_safrinha', 'milho_safrinha', 'milho_safrinha']
    setup({ today: { ...setupToday(), crops } })

    expect(screen.getByRole('region', { name: 'Como é hoje' })).toHaveTextContent('Hoje: milho sozinho nos 3 anos.')
  })

  it('sem NDVI para o ponto, pergunta direto', () => {
    setup({
      today: {
        rows: todayRows(null, [2024, 2025, 2026], {}, {}),
        hasSatellite: false,
        crops: TODAY,
        reference: true,
        referenceText: 'Referência de teste.',
        evaluation: { data: null, status: 'loading' },
      },
    })

    expect(screen.getByRole('region', { name: 'Como é hoje' })).toHaveTextContent(
      'Sem o satélite para o seu ponto: conte o que você fez nas últimas entressafras.',
    )
  })

  it('o sinal do outono continua, sem a regra antiga da data', () => {
    setup({ signal: testSignal })

    expect(screen.getByText(testSignal.motivo)).toBeInTheDocument()
    expect(screen.queryByText('Regra antiga de teste.')).not.toBeInTheDocument()
  })

  it('sem "Como teria sido em 2024?" e sem valor em reais', () => {
    setup()

    expect(screen.queryByText(/Como teria sido em/)).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/R\$/)
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en' })

    expect(screen.getByRole('table', { name: 'Scores of your plan next to how it is today' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Plan A and Plan B' })).toBeInTheDocument()
  })
})

function setupPlan(crops: CropId[] = PLAN): PlanViewProps['plan'] & object {
  return {
    years: crops.map((crop, index) => ({ year: 2027 + index, crop })),
    choices: planChoices(rec, null),
    edited: false,
    thirst: thirstByCrop(rec),
    options: rec.opcoes,
  }
}

function setupToday(): NonNullable<PlanViewProps['today']> {
  return {
    rows: todayRows(field.historico, field.anos_confirmaveis, {}, {}),
    hasSatellite: true,
    crops: TODAY,
    reference: true,
    referenceText: 'Referência de teste.',
    evaluation: { data: evaluation(TODAY), status: 'ready' },
  }
}
