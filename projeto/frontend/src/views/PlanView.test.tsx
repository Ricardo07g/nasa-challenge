import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { SinalOutono } from '../models/recomendacao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { buildPlan } from '../services/recomendacaoRules'
import { PlanView, type PlanViewProps } from './PlanView'

const rec = buildRecomendacao({ lat: -18.9543, lon: -48.1993, colheita: 'meio' }, 'pt')
/** Sinal de teste no formato da API (tarefa 0038): textos e números de teste, não são da NOAA nem do SMAP. */
const testSignal: SinalOutono = {
  nivel: 'normal',
  motivo: 'Previsão de teste: El Niño (70%, Fonte de teste). Nos 6 anos de El Niño, milho deu certo em 5.',
  fonte: ['Fonte de teste', 'Chuva de teste', 'SMAP'],
  data: '2026-11-14',
  regra_dia_plantar: {
    data_limite: '2027-02-28',
    texto: 'Se nos 30 dias antes de 28/fev chover menos que 90 mm (60% da média de 150 mm), vá de plano B.',
  },
  regra_data: { data_limite: '2027-02-28', inicio: '2027-01-29', dias: 30, chuva_min_mm: 90, media_mm: 150 },
  smap_agora: { percentil: 59, data: '2026-11-10', texto: 'Linha de teste do SMAP de agora, percentil 59.' },
}
const nav = {
  label: 'Telas da resposta',
  backTo: '/quando?lat=-18.9543&lon=-48.1993&colheita=meio',
  tabs: [
    { to: '/resposta', label: 'Resposta', current: false },
    { to: '/plano', label: 'Plano de 3 anos', current: true },
    { to: '/opcoes', label: 'Todas as opções', current: false },
  ],
}

function setup(overrides: Partial<PlanViewProps> = {}) {
  const props: PlanViewProps = {
    t: pt,
    lang: 'pt',
    nav,
    status: 'ready',
    onRetry: vi.fn(),
    signal: rec.sinal ?? null,
    scenario: 'normal',
    onScenario: vi.fn(),
    areaInput: '50',
    onAreaChange: vi.fn(),
    onAreaCommit: vi.fn(),
    onAreaStep: vi.fn(),
    totals: { margin: 35000, seed: 26000, worstDry: -9000 },
    rule: { text: 'No dia de plantar (até 28/fev), se a terra estiver seca, use o plano B: sorgo no lugar do milho.' },
    plan: buildPlan(rec, 'normal'),
    communityTo: '/comunidade?lat=-18.9543&lon=-48.1993&colheita=meio',
    pastTo: '/safra-passada?lat=-18.9543&lon=-48.1993&colheita=meio&ano=2024',
    showGainReference: true,
    ...overrides,
  }
  render(
    <MemoryRouter>
      <PlanView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe('PlanView (tela 7)', () => {
  it('sinal para o outono com o nível, o motivo, a fonte e o plano que ele marca (RF-20, tarefa 0038)', () => {
    setup({ signal: testSignal })

    const signal = screen.getByRole('region', { name: 'Sinal para o outono de 2027' })
    expect(within(signal).getByText('Sinal de ano normal')).toBeInTheDocument()
    expect(signal).toHaveTextContent('Nos 6 anos de El Niño, milho deu certo em 5.')
    expect(signal).toHaveTextContent('Chance de El Niño e La Niña publicada por Fonte de teste em 14 de novembro.')
    expect(signal).toHaveTextContent('O sinal marca o Plano A.')
    expect(signal).not.toHaveTextContent('Deixe o plano B na manga.')
  })

  it('sinal de ano seco marca o Plano B, se secar', () => {
    setup({ signal: { ...testSignal, nivel: 'seco' }, scenario: 'seco' })

    const signal = screen.getByRole('region', { name: 'Sinal para o outono de 2027' })
    expect(signal).toHaveTextContent('O sinal marca o Plano B, se secar.')
  })

  it('sem sinal claro, não diz que marca um plano e deixa o plano B na manga', () => {
    setup({ signal: { ...testSignal, nivel: 'incerto' } })

    const signal = screen.getByRole('region', { name: 'Sinal para o outono de 2027' })
    expect(within(signal).getByText('Sem sinal claro')).toBeInTheDocument()
    expect(signal).not.toHaveTextContent('O sinal marca')
    expect(signal).toHaveTextContent('Deixe o plano B na manga.')
  })

  it('a umidade de agora pelo SMAP aparece só para informar (não decide o plano)', () => {
    setup({ signal: testSignal })

    const signal = screen.getByRole('region', { name: 'Sinal para o outono de 2027' })
    expect(signal).toHaveTextContent('Linha de teste do SMAP de agora, percentil 59.')
    expect(signal).toHaveTextContent('A umidade de agora só informa: não muda o plano.')
  })

  it('sem o SMAP de agora na API, a linha do SMAP não aparece', () => {
    setup({ signal: { ...testSignal, smap_agora: null } })

    expect(screen.queryByText(/não muda o plano/)).not.toBeInTheDocument()
  })

  it('Plano A e Plano B, com o marcado pelo controller', async () => {
    const props = setup()

    expect(screen.getByRole('button', { name: 'Plano A' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Plano B, se secar' }))
    expect(props.onScenario).toHaveBeenCalledWith('seco')
  })

  it('no Plano B, diz como ele foi testado (texto da API) e mostra a troca na linha do tempo', () => {
    setup({ scenario: 'seco', plan: buildPlan(rec, 'seco') })

    expect(screen.getByText('Troca o milho pelo sorgo no ano seco.')).toBeInTheDocument()
    expect(screen.queryByText(/últimos 20/)).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Plano ano a ano' })).toHaveTextContent(
      '2027SorgoNo lugar de milho com braquiária: aguenta mais a seca.',
    )
  })

  it('sem o sinal na API, o cartão do sinal não some: diz "Ainda não conectado" e o Plano A/B continua', () => {
    setup({ signal: null })

    const signal = screen.getByRole('region', { name: 'Sinal para o outono de 2027' })
    expect(signal).toHaveTextContent('Ainda não conectado')
    expect(signal).not.toHaveTextContent('publicada por')
    expect(within(signal).getByRole('button', { name: 'Plano A' })).toBeInTheDocument()
  })

  it('hectares para testar com os totais em reais (RF-21)', async () => {
    const props = setup()

    const area = screen.getByRole('region', { name: 'Comece por um pedaço' })
    expect(within(area).getByLabelText('Quantos hectares quer testar?')).toHaveValue(50)
    expect(area).toHaveTextContent('Deve sobrar perto de R$ 35 mil')
    expect(area).toHaveTextContent('A semente custa perto de R$ 26 mil')
    expect(area).toHaveTextContent('No pior ano seco, faltaria perto de R$ 9.000')
    await userEvent.click(within(area).getByRole('button', { name: 'Aumentar 10 hectares' }))
    expect(props.onAreaStep).toHaveBeenCalledWith(10)
  })

  it('sem o custo da semente e o pior ano na API, as linhas ficam com "Ainda não conectado" (sem número)', () => {
    setup({ totals: { margin: 35000, seed: null, worstDry: null } })

    const area = screen.getByRole('region', { name: 'Comece por um pedaço' })
    expect(area).toHaveTextContent('Deve sobrar perto de R$ 35 mil')
    expect(area).toHaveTextContent('Custo da semente: Ainda não conectado')
    expect(area).toHaveTextContent('Pior ano seco: Ainda não conectado')
    expect(area).not.toHaveTextContent('A semente custa')
  })

  it('pior ano seco que ainda sobra dinheiro', () => {
    setup({ totals: { margin: 35000, seed: 8000, worstDry: 6000 } })

    expect(screen.getByText('No pior ano seco, sobraria perto de R$ 6.000')).toBeInTheDocument()
  })

  it('regra do dia de plantar sem o sinal: montada com a data limite', () => {
    setup({ signal: null, rule: { date: '2027-02-28', planA: 'milho_braquiaria', planB: 'sorgo' } })

    expect(
      screen.getByText(
        'No dia de plantar (até 28 de fevereiro), se a terra estiver seca, use o plano B: sorgo no lugar de milho com braquiária.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('O satélite mede a água na raiz. Você não precisa adivinhar.')).toBeInTheDocument()
  })

  it('regra da data (tarefa 0038): o texto da API e como medir a chuva', () => {
    setup({ signal: testSignal, rule: { text: testSignal.regra_dia_plantar.texto } })

    expect(screen.getByText(testSignal.regra_dia_plantar.texto)).toBeInTheDocument()
    expect(
      screen.getByText('Meça a chuva no seu pluviômetro. A média vem da série de chuva do satélite no seu ponto.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('O satélite mede a água na raiz. Você não precisa adivinhar.')).not.toBeInTheDocument()
  })

  it('resumo do plano, como é hoje e o link para a região', () => {
    setup()

    expect(screen.getByRole('region', { name: 'Com plano' })).toHaveTextContent('Terra coberta nos 3 anos · Grão em 2 de 3 anos')
    expect(screen.getByRole('region', { name: 'Como é hoje' })).toHaveTextContent('Terra descoberta em metade dos anos')
    expect(screen.getByRole('link', { name: 'Ver o que acontece na sua região' })).toHaveAttribute(
      'href',
      '/comunidade?lat=-18.9543&lon=-48.1993&colheita=meio',
    )
  })

  it('o estudo ilustrativo do ganho na soja só aparece com os dados de exemplo', () => {
    setup({ showGainReference: true })
    expect(screen.getByText('Referência ilustrativa; estudo a confirmar.')).toBeInTheDocument()
  })

  it('com a API real, o estudo ilustrativo (que não vem de dado nenhum) sai da tela', () => {
    setup({ showGainReference: false })

    expect(screen.queryByText('O ganho vem na soja seguinte')).not.toBeInTheDocument()
    expect(screen.queryByText(/11%/)).not.toBeInTheDocument()
  })

  it('enquanto carrega e fora da área', () => {
    const { unmount } = render(
      <MemoryRouter>
        <PlanView {...({ t: pt, lang: 'pt', nav, status: 'loading', plan: null } as unknown as PlanViewProps)} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('Carregando…')
    unmount()

    setup({ status: 'outside', plan: null })
    expect(screen.getByRole('region', { name: 'Ainda não chegamos aí' })).toBeInTheDocument()
  })

  it('em inglês', () => {
    setup({ t: en, lang: 'en', signal: { ...testSignal, nivel: 'seco' } })

    expect(screen.getByRole('heading', { level: 1, name: '3-year plan' })).toBeInTheDocument()
    expect(screen.getByText('Dry-year signal')).toBeInTheDocument()
    expect(screen.getByText('El Niño and La Niña chances published by Fonte de teste on November 14.')).toBeInTheDocument()
    expect(screen.getByText('The signal marks Plan B, if it dries.')).toBeInTheDocument()
    expect(screen.getByText('Current soil moisture is for information only: it does not change the plan.')).toBeInTheDocument()
    expect(screen.getByText('About R$ 35 thousand should remain')).toBeInTheDocument()
  })

  it('leva ao replay da safra passada (P4)', () => {
    setup()

    expect(screen.getByRole('link', { name: 'Como teria sido em 2024?' })).toHaveAttribute(
      'href',
      '/safra-passada?lat=-18.9543&lon=-48.1993&colheita=meio&ano=2024',
    )
  })
})
