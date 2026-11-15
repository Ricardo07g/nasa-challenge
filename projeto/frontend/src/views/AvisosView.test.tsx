import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { Aviso, Avisos } from '../models/avisos'
import { buildAvisos } from '../repositories/mocks/mockAvisos'
import { alertGroups } from '../services/avisosService'
import { AvisosView, type AvisosViewProps } from './AvisosView'

const POINT = { lat: -18.9543, lon: -48.1993 }

function aviso(tipo: string, valores: Aviso['valores'], changes: Partial<Aviso> = {}): Aviso {
  return { tipo, nivel: 'atencao', fontes: ['smap'], data: '2026-11-10', antiga: false, valores, ...changes }
}

function props(avisos: Avisos | null, changes: Partial<AvisosViewProps> = {}): AvisosViewProps {
  return {
    t: pt,
    lang: 'pt',
    status: avisos ? 'ready' : 'no-point',
    onRetry: vi.fn(),
    avisos,
    groups: avisos ? alertGroups(avisos) : [],
    place: avisos ? 'Uberlândia (MG)' : null,
    explorerTo: avisos ? '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio&ano=2024' : null,
    markTo: '/onde',
    backTo: '/',
    ...changes,
  }
}

function renderView(p: AvisosViewProps) {
  return render(
    <MemoryRouter>
      <AvisosView {...p} />
    </MemoryRouter>,
  )
}

function group(name: string) {
  return screen.getByRole('region', { name })
}

describe('AvisosView (tela "Avisos")', () => {
  it('sem ponto, pede para marcar a lavoura e mostra os alertas oficiais', () => {
    renderView(props(null))

    expect(screen.getByRole('heading', { level: 1, name: 'Avisos' })).toBeInTheDocument()
    expect(screen.getByText(/marque onde fica a sua lavoura/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Marcar minha lavoura' })).toHaveAttribute('href', '/onde')
    expect(group('Alertas oficiais')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Agora' })).not.toBeInTheDocument()
  })

  it('os quatro grupos na ordem, com o lugar da lavoura', () => {
    renderView(props(buildAvisos(POINT, 'pt')))

    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(titles).toEqual(['Agora', 'O que mudou na sua área', 'Fora do comum', 'Perto de você', 'Alertas oficiais'])
    expect(screen.getByText('Lavoura perto de Uberlândia (MG)')).toBeInTheDocument()
  })

  it('cada aviso tem o nível em texto, o que o dado mostra, o que fazer, a fonte e a data', () => {
    renderView(props(buildAvisos(POINT, 'pt')))

    const agora = group('Agora')
    const item = within(agora).getByRole('listitem')
    expect(within(item).getByText('Fique de olho')).toBeInTheDocument()
    expect(item).toHaveTextContent(
      'Previsão da NOAA para fevereiro a abril de 2027: El Niño, com 98% de chance. Nos 7 anos de El Niño desde 2005, milho com braquiária deu certo em 5 aqui; nos outros 13 anos, em 11. São poucos anos.',
    )
    expect(item).toHaveTextContent('O que fazer: Veja o Plano B no Plano de 3 anos antes de decidir o que plantar.')
    expect(item).toHaveTextContent('Fonte: NOAA, GPM IMERG (NASA) · leitura de 12 de novembro de 2026')
  })

  it('terra seca pelo SMAP, com a leitura antiga marcada', () => {
    const avisos = buildAvisos(POINT, 'pt')
    const dry = aviso('terra_seca', { percentil: 15.3, mais_seca_que_pct: 85 }, { antiga: true })
    renderView(props({ ...avisos, agora: { avisos: [dry], ultima_leitura: '2026-11-10' } }))

    const item = within(group('Agora')).getByRole('listitem')
    expect(within(item).getByText('Atenção')).toBeInTheDocument()
    expect(item).toHaveTextContent('A terra está mais seca que em 85% dos anos nesta época.')
    expect(item).toHaveTextContent('Fonte: NASA SMAP · leitura de 10 de novembro de 2026 · Leitura antiga')
  })

  it('dias sem chuva e calor pelo NASA POWER', () => {
    const avisos = buildAvisos(POINT, 'pt')
    const power = { fontes: ['nasa_power'], data: '2026-11-12' }
    renderView(
      props({
        ...avisos,
        agora: {
          avisos: [
            aviso('dias_sem_chuva', { dias: 12, desde: '2026-11-01', no_minimo: false }, power),
            aviso('calor', { dias: 3, janela_dias: 10, temp_c: 35 }, power),
          ],
          ultima_leitura: '2026-11-12',
        },
      }),
    )

    const agora = group('Agora')
    expect(agora).toHaveTextContent('12 dias seguidos sem chuva (menos de 1 mm por dia) até 12 de novembro.')
    expect(agora).toHaveTextContent('3 dias com 35 °C ou mais nos últimos 10 dias.')
    expect(agora).toHaveTextContent('Fonte: NASA POWER · leitura de 12 de novembro de 2026')
  })

  it('grupo sem aviso: "Nada fora do normal" com a data da última leitura', () => {
    const avisos = buildAvisos(POINT, 'pt')
    renderView(props({ ...avisos, agora: { avisos: [], ultima_leitura: '2026-11-12' } }))

    const agora = group('Agora')
    expect(within(agora).queryByRole('listitem')).not.toBeInTheDocument()
    expect(agora).toHaveTextContent('Nada fora do normal.')
    expect(agora).toHaveTextContent('Última leitura: 12 de novembro de 2026.')
  })

  it('fora da safrinha, o link para ver os avisos de 2024 abre o ano na resposta', () => {
    renderView(props(buildAvisos(POINT, 'pt')))

    const agora = group('Agora')
    expect(agora).toHaveTextContent('A próxima safrinha (milho com braquiária) começa por volta de 18 de fevereiro de 2027.')
    expect(within(agora).getByRole('link', { name: 'Ver como teriam sido os avisos em 2024' })).toHaveAttribute(
      'href',
      '/resposta?lat=-18.9543&lon=-48.1993&colheita=meio&ano=2024',
    )
  })

  it('o que mudou: os dois números lado a lado e o aviso de que são poucos anos', () => {
    renderView(props(buildAvisos(POINT, 'pt')))

    const mudou = group('O que mudou na sua área')
    expect(mudou).toHaveTextContent('2020 a 2024 comparado com 2005 a 2019, na sua área.')
    expect(mudou).toHaveTextContent('São poucos anos: mostra o que aconteceu, não uma previsão.')
    expect(mudou).toHaveTextContent(
      'Maior veranico de março a maio: 27,2 dias em média em 2020–2024; 20,8 dias em 2005–2019.',
    )
    expect(mudou).toHaveTextContent(
      'Milho com braquiária deu certo em 3 de 5 anos em 2020–2024; em 13 de 15 anos em 2005–2019.',
    )
    expect(mudou).toHaveTextContent('O que fazer: Leve isso em conta ao escolher o que plantar.')
    expect(mudou).toHaveTextContent('Fonte: GPM IMERG (NASA) · dados até 30 de julho de 2024')
  })

  it('fora do comum: os recordes com o ano', () => {
    renderView(props(buildAvisos(POINT, 'pt')))

    const recordes = group('Fora do comum')
    expect(recordes).toHaveTextContent(
      'Maior veranico de março a maio: 43 dias seguidos sem chuva a partir de 19 de abril de 2024.',
    )
    expect(recordes).toHaveTextContent('Outono mais seco: 178 mm de março a maio de 2021 (a média é 330,7 mm).')
  })

  it('perto de você: relato de vizinho, não confirmado, e o 193 no fogo', () => {
    const avisos = buildAvisos(POINT, 'pt')
    const fire = aviso('vizinho_evento', { evento: 'fogo', relatos: 2 }, { fontes: ['comunidade'], data: '2026-11-14' })
    renderView(props({ ...avisos, perto: { avisos: [fire], ultima_leitura: '2026-11-15' } }))

    const perto = group('Perto de você')
    expect(perto).toHaveTextContent('Eventos contados por vizinhos até 30 km, nos últimos 7 dias.')
    expect(perto).toHaveTextContent('Fogo: 2 relatos de vizinhos até 30 km; o mais recente em 14 de novembro.')
    expect(perto).toHaveTextContent('Relato de vizinho, não confirmado')
    expect(perto).toHaveTextContent('O que fazer: Em caso de fogo, ligue 193 (Bombeiros).')
  })

  it('rodapé "Alertas oficiais": SMS 40199, WhatsApp, 193, 199 e o artigo do Guia', () => {
    renderView(props(buildAvisos(POINT, 'pt')))

    const official = group('Alertas oficiais')
    expect(official).toHaveTextContent(
      'Estes avisos não são alertas oficiais e não substituem a Defesa Civil nem o INMET.',
    )
    expect(official).toHaveTextContent('Para receber os alertas oficiais da Defesa Civil no celular, de graça:')
    expect(official).toHaveTextContent('Alertas graves chegam sozinhos pelo "Defesa Civil Alerta", sem cadastro.')
    expect(official).toHaveTextContent('Em caso de fogo, ligue 193 (Bombeiros). Emergência da Defesa Civil: 199.')
    expect(within(official).getByRole('link', { name: 'Enviar SMS para 40199' })).toHaveAttribute('href', 'sms:40199')
    expect(within(official).getByRole('link', { name: 'Abrir conversa no WhatsApp' })).toHaveAttribute(
      'href',
      'https://wa.me/556120344611',
    )
    expect(within(official).getByRole('link', { name: 'Ligar 193 (Bombeiros)' })).toHaveAttribute('href', 'tel:193')
    expect(within(official).getByRole('link', { name: 'Ligar 199 (Defesa Civil)' })).toHaveAttribute('href', 'tel:199')
    expect(
      within(official).getByRole('link', { name: 'Como receber os alertas oficiais da Defesa Civil' }),
    ).toHaveAttribute('href', '/guia/alertas-defesa-civil')
  })

  it('em inglês, para os juízes', () => {
    renderView(props(buildAvisos(POINT, 'en'), { t: en, lang: 'en' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Alerts' })).toBeInTheDocument()
    const now = group('Now')
    expect(within(now).getByText('Keep an eye on it')).toBeInTheDocument()
    expect(now).toHaveTextContent('NOAA forecast for February to April 2027: El Niño, with a 98% chance.')
    expect(group('Official alerts')).toHaveTextContent('Send SMS to 40199')
  })

  it('carregando, erro e fora da área', () => {
    const { unmount } = renderView(props(null, { status: 'loading' }))
    expect(screen.getByText('Carregando…')).toBeInTheDocument()
    unmount()

    const error = renderView(props(null, { status: 'error' }))
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
    error.unmount()

    renderView(props(null, { status: 'outside' }))
    expect(screen.getByText(pt.where.outsideTitle)).toBeInTheDocument()
  })
})
