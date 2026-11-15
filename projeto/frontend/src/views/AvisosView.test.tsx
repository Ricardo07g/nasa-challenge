import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type { AvisosState } from '../controllers/useAvisosController'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { Aviso, Avisos } from '../models/avisos'
import { buildAvisos } from '../repositories/mocks/mockAvisos'
import { alertsSummary, changeTiles, exampleRows, nowAlerts, recordTiles } from '../services/avisosService'
import { newTabName } from '../test/newTabName'
import { AvisosView } from './AvisosView'

const POINT = { lat: -18.9543, lon: -48.1993 }

function aviso(tipo: string, valores: Aviso['valores'], changes: Partial<Aviso> = {}): Aviso {
  return { tipo, nivel: 'atencao', fontes: ['nasa_power'], data: '2026-11-12', antiga: false, valores, ...changes }
}

function withNow(list: Aviso[]): Avisos {
  return { ...buildAvisos(POINT, 'pt'), contador: list.length, agora: { avisos: list, ultima_leitura: '2026-11-12' } }
}

function state(avisos: Avisos | null, changes: Partial<AvisosState> = {}): AvisosState {
  return {
    status: avisos ? 'ready' : 'no-point',
    retry: vi.fn(),
    avisos,
    place: avisos ? 'Lavoura perto de Uberlândia (MG)' : null,
    summary: avisos ? alertsSummary(avisos) : null,
    now: avisos ? nowAlerts(avisos) : [],
    recentReadings: true,
    changes: avisos ? changeTiles(avisos, 'milho_braquiaria') : [],
    records: avisos ? recordTiles(avisos) : [],
    plan: avisos ? { crop: 'sorgo', deadline: '2027-03-20', late: false } : null,
    example: { year: avisos ? 2024 : null, open: false, status: 'ready', rows: [], onOpen: vi.fn(), onClose: vi.fn() },
    detail: null,
    openDetail: vi.fn(),
    closeDetail: vi.fn(),
    markTo: '/onde',
    backTo: '/',
    listen: { supported: true, speaking: false, toggle: vi.fn() },
    ...changes,
  }
}

function renderView(s: AvisosState, t = pt, lang: 'pt' | 'en' = 'pt') {
  return render(
    <MemoryRouter>
      <AvisosView t={t} lang={lang} state={s} />
    </MemoryRouter>,
  )
}

const region = (name: string) => screen.getByRole('region', { name })

describe('AvisosView: topo (pacote 3, tela 7)', () => {
  it('"← Voltar", título, o lugar com a data, "Ouvir resumo" e "Como ler os avisos" em nova aba', async () => {
    const s = state(buildAvisos(POINT, 'pt'))
    renderView(s)

    expect(screen.getByRole('link', { name: /Voltar/ })).toHaveAttribute('data-back-button')
    expect(screen.getByRole('heading', { level: 1, name: 'Avisos' })).toBeInTheDocument()
    expect(screen.getByText(/Lavoura perto de Uberlândia \(MG\) · atualizado em/).closest('p')).toHaveTextContent(
      'Lavoura perto de Uberlândia (MG) · atualizado em 15 de novembro de 2026',
    )
    const guide = screen.getByRole('link', { name: newTabName('Como ler os avisos') })
    expect(guide).toHaveAttribute('href', '/guia/como-ler-os-avisos')
    expect(guide).toHaveAttribute('target', '_blank')
    await userEvent.click(screen.getByRole('button', { name: 'Ouvir resumo' }))
    expect(s.listen.toggle).toHaveBeenCalled()
  })

  it('sem ponto: pede para marcar a lavoura, com os alertas oficiais e o "Em breve"; sem resumo', () => {
    renderView(state(null))

    expect(screen.getByText(/marque onde fica a sua lavoura/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Marcar minha lavoura' })).toHaveAttribute('href', '/onde')
    expect(region('Alertas oficiais')).toBeInTheDocument()
    expect(region('Comunidade da sua região')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Agora' })).not.toBeInTheDocument()
    expect(document.querySelector('[data-summary]')).toBeNull()
  })

  it('carregando, erro e fora da área', async () => {
    const { unmount } = renderView(state(null, { status: 'loading', place: 'Lavoura perto de Prata (MG)' }))
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
    expect(screen.getByText('Lavoura perto de Prata (MG)')).toBeInTheDocument()
    unmount()

    const failing = state(null, { status: 'error' })
    const second = renderView(failing)
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(failing.retry).toHaveBeenCalled()
    second.unmount()

    renderView(state(null, { status: 'outside' }))
    expect(screen.getByRole('region', { name: pt.where.outsideTitle })).toBeInTheDocument()
  })
})

describe('AvisosView: o resumo', () => {
  const watch = aviso('enso', ENSO_VALUES(), { nivel: 'fique_de_olho', fontes: ['noaa', 'gpm_imerg'] })
  const dry = aviso('terra_seca', { percentil: 15, mais_seca_que_pct: 85 }, { fontes: ['smap'], data: '2026-11-10' })

  it('sem aviso: verde, "Nada fora do normal agora", sem a legenda dos níveis', () => {
    renderView(state(withNow([])))

    const card = document.querySelector('[data-summary]')!
    expect(card).toHaveAttribute('data-summary', 'ok')
    expect(card).toHaveTextContent('Nada fora do normal agora')
    expect(card).toHaveTextContent('Os avisos aparecem aqui e no sino lá em cima quando algo mudar.')
    expect(card).not.toHaveTextContent('aja agora')
  })

  it('só "Fique de olho": azul, "1 aviso agora", "Para ficar de olho, sem urgência." e a legenda', () => {
    renderView(state(withNow([watch])))

    const card = document.querySelector('[data-summary]')!
    expect(card).toHaveAttribute('data-summary', 'watch')
    expect(card).toHaveTextContent('1 aviso agora')
    expect(card).toHaveTextContent('Para ficar de olho, sem urgência.')
    expect(card).toHaveTextContent('Atenção aja agora')
    expect(card).toHaveTextContent('Fique de olho acompanhe')
  })

  it('com "Atenção": laranja, "{n} avisos agora" e quantos pedem atenção', () => {
    renderView(state(withNow([watch, dry, aviso('calor', { dias: 4, janela_dias: 10, temp_c: 35 })])))

    const card = document.querySelector('[data-summary]')!
    expect(card).toHaveAttribute('data-summary', 'attention')
    expect(card).toHaveTextContent('3 avisos agora')
    expect(card).toHaveTextContent('2 pedem atenção.')
  })
})

describe('AvisosView: "Agora"', () => {
  it('cada aviso é um cartão-botão: nível, "Detalhes", título com o número, o que fazer e a fonte; "Atenção" antes', async () => {
    const s = state(buildAvisos(POINT, 'pt'))
    renderView(s)

    const now = region('Agora')
    expect(now).toHaveTextContent('Leituras de satélite e previsão desta semana')
    const cards = within(now).getAllByRole('button', { name: /Detalhes/ })
    expect(cards).toHaveLength(2)
    expect(cards[0]).toHaveAttribute('data-level', 'atencao')
    expect(cards[0]).toHaveTextContent('Atenção')
    expect(cards[0]).toHaveTextContent('A terra está mais seca que o normal: mais seca que em 85% dos anos')
    expect(cards[0]).toHaveTextContent('O que fazer: Confira a umidade da terra antes de plantar ou adubar.')
    expect(cards[0]).toHaveTextContent('Fonte: NASA SMAP · leitura de 10 de novembro de 2026')
    expect(cards[1]).toHaveTextContent('Fique de olho')
    expect(cards[1]).toHaveTextContent('El Niño previsto para fevereiro a abril de 2027: 98% de chance')

    await userEvent.click(cards[1])
    expect(s.openDetail).toHaveBeenCalledWith('now', 1)
  })

  it('o modal do cartão: nível, título, número, o que significa, o que fazer, fonte com data e "Saiba mais" em nova aba', () => {
    renderView(state(buildAvisos(POINT, 'pt'), { detail: { kind: 'now', index: 0 } }))

    const dialog = screen.getByRole('dialog', { name: 'A terra está mais seca que o normal' })
    expect(dialog).toHaveTextContent('Atenção')
    expect(dialog).toHaveTextContent('mais seca que em 85% dos anos')
    expect(within(dialog).getByRole('heading', { name: 'O que significa' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Hoje a sua área está mais seca do que em 85% dos anos nesta mesma época.')
    expect(within(dialog).getByRole('heading', { name: 'O que fazer' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Fonte: NASA SMAP · leitura de 10 de novembro de 2026')
    const more = within(dialog).getByRole('link', { name: newTabName('Saiba mais: a conta de água da lavoura') })
    expect(more).toHaveAttribute('href', '/guia/conta-de-agua')
    expect(more).toHaveAttribute('target', '_blank')
  })

  it('sem aviso: a caixa verde "Nada fora do normal"; leituras antigas dizem até quando', () => {
    renderView(state(withNow([]), { recentReadings: false }))

    const now = region('Agora')
    expect(now).toHaveTextContent('Nada fora do normal')
    expect(now).toHaveTextContent('Calor, dias sem chuva e terra seca estão dentro do esperado.')
    expect(now).toHaveTextContent('Leituras de satélite e previsão até 12 de novembro de 2026')
  })

  it('a linha do plano e o "Ver exemplo: avisos de 2024", que abre o modal', async () => {
    const s = state(buildAvisos(POINT, 'pt'))
    renderView(s)

    const now = region('Agora')
    expect(now).toHaveTextContent(
      'Seu plano: sorgo, plantio até 20 de mar. Durante o ciclo, aparecem aqui os avisos de veranico e de calor na floração.',
    )
    expect(within(now).getByText('sorgo').tagName).toBe('STRONG')
    await userEvent.click(within(now).getByRole('button', { name: 'Ver exemplo: avisos de 2024' }))
    expect(s.example.onOpen).toHaveBeenCalled()
  })

  it('sem o ano do exemplo, sem o link; sem plano, sem a linha', () => {
    renderView(state(buildAvisos(POINT, 'pt'), { plan: null, example: { ...state(null).example, year: null } }))

    expect(screen.queryByRole('button', { name: /Ver exemplo/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/Seu plano/)).not.toBeInTheDocument()
  })

  it('o modal do exemplo: as linhas com quando, o nível e o que aconteceu, e a fonte', () => {
    const avisos = buildAvisos(POINT, 'pt')
    const rows = exampleRows(
      2024,
      {
        ano: 2024,
        opcao: 'sorgo',
        eventos: [
          { data: '2024-04-19', tipo: 'sem_chuva', texto: 'Parou de chover.' },
          { data: '2024-04-28', tipo: 'aviso_veranico', texto: 'Aviso: 10 dias sem chuva perto da fase que mais precisa de água.' },
        ],
      },
      avisos,
    )
    renderView(state(avisos, { example: { ...state(avisos).example, open: true, rows } }))

    const dialog = screen.getByRole('dialog', { name: 'Como teriam sido os avisos em 2024' })
    const items = within(dialog).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('28 de abr')
    expect(items[0]).toHaveTextContent('Atenção')
    expect(items[0]).toHaveTextContent('O veranico tinha começado em 19 de abril.')
    expect(items[1]).toHaveTextContent('19 de abr')
    expect(items[1]).toHaveTextContent('Começou um veranico de 43 dias seguidos sem chuva')
    expect(items[2]).toHaveTextContent('mar–mai')
    expect(dialog).toHaveTextContent('Fonte: GPM IMERG e NASA POWER (NASA). Exemplo montado com dados de 2024.')
  })

  it('o modal do exemplo carregando e sem nada para avisar', () => {
    const avisos = buildAvisos(POINT, 'pt')
    const { unmount } = renderView(state(avisos, { example: { ...state(avisos).example, open: true, status: 'loading' } }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Montando o exemplo…')
    unmount()

    renderView(state(avisos, { example: { ...state(avisos).example, open: true, rows: [] } }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Em 2024, não houve nada fora do normal para avisar na sua área.')
  })
})

describe('AvisosView: quadros', () => {
  it('"Como a sua área está mudando": o antes riscado, o depois grande (laranja quando piorou) e os períodos', async () => {
    const s = state(buildAvisos(POINT, 'pt'))
    renderView(s)

    const changed = region('Como a sua área está mudando')
    expect(changed).toHaveTextContent('2020–2024 comparado com 2005–2019. São poucos anos: mostra o que aconteceu, não uma previsão.')
    const tiles = within(changed).getAllByRole('button', { name: /Ver detalhes/ })
    expect(tiles).toHaveLength(4)
    expect(tiles[0]).toHaveTextContent('Maior veranico (mar–mai)')
    expect(within(tiles[0]).getByText('20,8 dias').tagName).toBe('S')
    expect(within(tiles[0]).getByText('27,2 dias')).toHaveAttribute('data-worse', 'true')
    expect(tiles[0]).toHaveTextContent('2005–19 → 2020–24')

    await userEvent.click(tiles[2])
    expect(s.openDetail).toHaveBeenCalledWith('change', 2)
  })

  it('o modal do quadro: o que significa, o que fazer, a fonte com "dados até" e o Saiba mais', () => {
    renderView(state(buildAvisos(POINT, 'pt'), { detail: { kind: 'change', index: 1 } }))

    const dialog = screen.getByRole('dialog', { name: 'Fim das chuvas' })
    expect(dialog).toHaveTextContent('24 de abr → 13 de abr')
    expect(dialog).toHaveTextContent('A chuva do outono terminou, em média, 11 dias mais cedo em 2020–2024 do que em 2005–2019.')
    expect(dialog).toHaveTextContent('Fonte: GPM IMERG (NASA) · dados até 30 de julho de 2024')
    expect(within(dialog).getByRole('link', { name: newTabName('Saiba mais: quando a chuva acaba') })).toHaveAttribute(
      'href',
      '/guia/quando-a-chuva-acaba',
    )
  })

  it('"Já aconteceu aqui": 4 quadros com o número grande, a frase e o modal com a fonte e a data', async () => {
    const s = state(buildAvisos(POINT, 'pt'))
    const { unmount } = renderView(s)

    const records = region('Já aconteceu aqui')
    expect(records).toHaveTextContent('O mais extremo de 2005 a 2024 na sua área. Pode voltar: planeje pensando num ano assim.')
    const tiles = within(records).getAllByRole('button', { name: /Ver detalhes/ })
    expect(tiles).toHaveLength(4)
    expect(tiles[0]).toHaveTextContent('Maior veranico43 diasseguidos sem chuva, a partir de 19 de abr de 2024')
    await userEvent.click(tiles[3])
    expect(s.openDetail).toHaveBeenCalledWith('record', 3)
    unmount()

    renderView(state(buildAvisos(POINT, 'pt'), { detail: { kind: 'record', index: 3 } }))
    const dialog = screen.getByRole('dialog', { name: 'Ano com mais calor' })
    expect(dialog).toHaveTextContent('3 dias com 35 °C ou mais de março a maio de 2024.')
    expect(dialog).toHaveTextContent('Fonte: NASA POWER · dados até 30 de julho de 2024')
  })

  it('sem série, os dois blocos de quadros não aparecem', () => {
    renderView(state(buildAvisos(POINT, 'pt'), { changes: [], records: [] }))

    expect(screen.queryByRole('region', { name: 'Como a sua área está mudando' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Já aconteceu aqui' })).not.toBeInTheDocument()
  })
})

describe('AvisosView: alertas oficiais e comunidade', () => {
  it('"Alertas oficiais" com a âncora, o aviso, os 4 botões (sms, wa.me, tel) e o Guia em nova aba', () => {
    renderView(state(buildAvisos(POINT, 'pt')))

    const official = region('Alertas oficiais')
    expect(official).toHaveAttribute('id', 'alertas-oficiais')
    expect(official).toHaveTextContent('Estes avisos não substituem a Defesa Civil nem o INMET. Receba os alertas oficiais de graça:')
    expect(within(official).getByRole('link', { name: 'SMS com o seu CEP Enviar para 40199' })).toHaveAttribute('href', 'sms:40199')
    const whatsapp = within(official).getByRole('link', { name: /WhatsApp da Defesa Civil Mandar "Oi"/ })
    expect(whatsapp).toHaveAttribute('href', 'https://wa.me/556120344611?text=Oi')
    expect(whatsapp).toHaveAttribute('target', '_blank')
    expect(within(official).getByRole('link', { name: 'Fogo Ligar 193' })).toHaveAttribute('href', 'tel:193')
    expect(within(official).getByRole('link', { name: 'Defesa Civil Ligar 199' })).toHaveAttribute('href', 'tel:199')
    expect(within(official).getByRole('link', { name: newTabName('Como receber os alertas oficiais') })).toHaveAttribute(
      'href',
      '/guia/alertas-defesa-civil',
    )
  })

  it('"Perto de você" não aparece mais, mesmo com relatos de vizinhos na resposta da API; entra o "Em breve", sem botão', () => {
    const avisos: Avisos = {
      ...buildAvisos(POINT, 'pt'),
      perto: {
        avisos: [aviso('vizinho_evento', { evento: 'geada', relatos: 1 }, { fontes: ['comunidade'] })],
        ultima_leitura: '2026-11-15',
      },
    }
    renderView(state(avisos))

    expect(screen.queryByText(/Perto de você/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Relato de vizinho/)).not.toBeInTheDocument()
    const soon = region('Comunidade da sua região')
    expect(soon).toHaveTextContent('Em breve')
    expect(soon).toHaveTextContent('Um espaço para acompanhar a sua região junto com os vizinhos.')
    expect(within(soon).getAllByRole('listitem')).toHaveLength(3)
    expect(within(soon).queryByRole('button')).not.toBeInTheDocument()
    expect(within(soon).queryByRole('link')).not.toBeInTheDocument()
  })
})

describe('AvisosView em inglês, para os juízes', () => {
  it('topo, resumo, cartões, quadros, oficiais e "Coming soon"', () => {
    const avisos = buildAvisos(POINT, 'en')
    renderView(state(avisos, { place: 'Field near Uberlândia (MG)' }), en, 'en')

    expect(screen.getByRole('heading', { level: 1, name: 'Alerts' })).toBeInTheDocument()
    expect(screen.getByText(/Field near Uberlândia \(MG\) · updated on/).closest('p')).toHaveTextContent('updated on November 15, 2026')
    expect(document.querySelector('[data-summary]')).toHaveTextContent('2 alerts now')
    expect(region('Now')).toHaveTextContent('The soil is drier than normal: drier than in 85% of years')
    expect(region('Now')).toHaveTextContent('Your plan: sorghum, plant by Mar 20.')
    expect(region('How your area is changing')).toHaveTextContent('Longest dry spell (Mar–May)')
    expect(region('It already happened here')).toHaveTextContent('Longest dry spell')
    expect(region('Official alerts')).toHaveTextContent('These alerts do not replace Civil Defense or INMET.')
    expect(region("Your region's community")).toHaveTextContent('Coming soon')
  })
})

function ENSO_VALUES(): Aviso['valores'] {
  return {
    fase: 'el_nino',
    chance_pct: 98,
    estacao: 'FMA',
    ano: 2027,
    cultura: 'milheto',
    nome: 'Milheto',
    anos_fase: 7,
    bons_fase: 7,
    anos_outros: 13,
    bons_outros: 13,
    ano_inicio: 2005,
    ano_fim: 2024,
    sinal: 'normal',
  }
}
