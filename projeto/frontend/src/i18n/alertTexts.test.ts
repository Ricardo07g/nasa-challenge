import { describe, expect, it } from 'vitest'
import type { Aviso } from '../models/avisos'
import { buildAvisos } from '../repositories/mocks/mockAvisos'
import { alertsSummary, nowAlerts } from '../services/avisosService'
import {
  alertsListen,
  changeText,
  exampleRowText,
  nowText,
  periodsLabel,
  placeLabel,
  planText,
  recordText,
  shortDate,
  sourceLine,
} from './alertTexts'
import { en } from './messages.en'
import { pt } from './messages.pt'

const PERIODO = { recente_inicio: 2020, recente_fim: 2024, antes_inicio: 2005, antes_fim: 2019 }

function aviso(tipo: string, valores: Aviso['valores'], changes: Partial<Aviso> = {}): Aviso {
  return { tipo, nivel: 'atencao', fontes: ['nasa_power'], data: '2026-11-12', antiga: false, valores, ...changes }
}

const ENSO = aviso(
  'enso',
  {
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
  },
  { nivel: 'fique_de_olho', fontes: ['noaa', 'gpm_imerg'] },
)

describe('alertTexts: os cartões de "Agora" (pacote 3, tela 7)', () => {
  it('terra seca: título curto com o número, o que fazer, o que significa e o Saiba mais', () => {
    const text = nowText(pt, 'pt', aviso('terra_seca', { percentil: 15, mais_seca_que_pct: 85 }, { fontes: ['smap'] }))

    expect(text).toEqual({
      title: 'A terra está mais seca que o normal',
      number: 'mais seca que em 85% dos anos',
      short: 'Confira a umidade da terra antes de plantar ou adubar.',
      meaning:
        'O satélite SMAP (NASA) estima a água na terra, na camada das raízes. Hoje a sua área está mais seca do que em 85% dos anos nesta mesma época.',
      todo: 'Confira a umidade da terra antes de plantar ou adubar. Com a terra seca, a semente pode não germinar e o adubo se perde.',
      guide: 'conta-de-agua',
      guideLabel: 'Saiba mais: a conta de água da lavoura',
    })
  })

  it('calor forte e dias sem chuva, com os números da API', () => {
    const heat = nowText(pt, 'pt', aviso('calor', { dias: 4, janela_dias: 10, temp_c: 35 }))
    const noRain = nowText(pt, 'pt', aviso('dias_sem_chuva', { dias: 12, desde: '2026-10-31', no_minimo: true }))

    expect(heat).toMatchObject({
      title: 'Calor forte nos últimos 10 dias',
      number: '4 dias com 35 °C ou mais',
      short: 'Se a lavoura estiver na floração, converse com o agrônomo.',
      meaning:
        'Foram 4 dias com máxima de 35 °C ou mais nos últimos 10 dias. Na floração, calor forte derruba as flores e diminui a colheita.',
      guide: 'calor-35-graus',
    })
    expect(noRain).toMatchObject({
      title: 'Dias seguidos sem chuva',
      number: 'pelo menos 12 dias sem chuva',
      meaning: 'Pelo menos 12 dias seguidos sem chuva (menos de 1 mm por dia) até 12 de novembro.',
      guide: 'veranico',
    })
  })

  it('El Niño: a previsão no título, a chance no número e o conselho do sinal do outono (o mesmo do Plano)', () => {
    expect(nowText(pt, 'pt', ENSO)).toMatchObject({
      title: 'El Niño previsto para fevereiro a abril de 2027',
      number: '98% de chance',
      short: 'Confira o sinal em fevereiro, antes de plantar.',
      meaning:
        'A NOAA prevê El Niño para fevereiro a abril de 2027, com 98% de chance. Nos 7 anos de El Niño desde 2005, milheto deu certo em 7 aqui; nos outros 13 anos, em 13. São poucos anos.',
      todo: pt.alerts.kinds.ensoTodo.normal,
      guide: 'el-nino-la-nina',
    })
    expect(nowText(en, 'en', { ...ENSO, valores: { ...ENSO.valores, fase: 'la_nina', anos_fase: null } })).toMatchObject({
      title: 'La Niña expected for February to April 2027',
      number: '98% chance',
      meaning: 'NOAA expects La Niña for February to April 2027, with a 98% chance.',
    })
    expect(nowText(pt, 'pt', { ...ENSO, valores: { ...ENSO.valores, fase: 'la_nina' } })?.title).toBe(
      'La Niña prevista para fevereiro a abril de 2027',
    )
  })

  it('a safrinha em andamento: veranico e calor perto da fase que mais precisa de água', () => {
    expect(nowText(pt, 'pt', aviso('safrinha_veranico', { dias: 11, cultura: 'sorgo', nome: 'Sorgo' }))).toMatchObject({
      title: 'Veranico na safrinha (sorgo)',
      number: '11 dias sem chuva',
      meaning: 'Foram 11 dias sem chuva até 12 de novembro, perto da fase em que a lavoura de sorgo mais precisa de água.',
      guide: 'veranico',
    })
    expect(
      nowText(pt, 'pt', aviso('safrinha_calor', { dias: 3, temp_c: 35, cultura: 'sorgo', nome: 'Sorgo' })),
    ).toMatchObject({ title: 'Calor na safrinha (sorgo)', number: '3 dias seguidos com 35 °C ou mais', guide: 'calor-35-graus' })
  })

  it('tipo que a tela não conhece não tem texto (e não aparece)', () => {
    expect(nowText(pt, 'pt', aviso('tipo_novo', {}))).toBeNull()
  })

  it('a fonte e a data da leitura; a leitura antiga avisa', () => {
    expect(sourceLine(pt, 'pt', ENSO, false)).toBe('Fonte: NOAA CPC, GPM IMERG (NASA) · leitura de 12 de novembro de 2026')
    expect(sourceLine(en, 'en', { ...ENSO, antiga: true }, false)).toBe(
      'Source: NOAA CPC, GPM IMERG (NASA) · read on November 12, 2026 · Old reading',
    )
    expect(sourceLine(pt, 'pt', aviso('mudou_veranico', {}, { fontes: ['gpm_imerg'], data: '2024-07-30' }), true)).toBe(
      'Fonte: GPM IMERG (NASA) · dados até 30 de julho de 2024',
    )
  })
})

describe('alertTexts: "Como a sua área está mudando"', () => {
  it('maior veranico: antes riscado, depois grande, pior em laranja e o modal com o que significa', () => {
    expect(changeText(pt, 'pt', aviso('mudou_veranico', { antes: 20.8, recente: 27.2 }), PERIODO)).toEqual({
      label: 'Maior veranico (mar–mai)',
      before: '20,8 dias',
      after: '27,2 dias',
      worse: true,
      title: 'Maior veranico (mar–mai)',
      number: '20,8 dias → 27,2 dias',
      meaning:
        'O maior período seguido sem chuva entre março e maio ficou mais longo: 27,2 dias em média em 2020–2024, contra 20,8 dias em 2005–2019.',
      todo: 'Prefira culturas que aguentam ficar sem chuva por algumas semanas e plante logo depois de colher.',
      guide: 'veranico',
      guideLabel: 'Saiba mais: veranico',
    })
  })

  it('fim das chuvas, falta de água e deu certo, com a cultura no rótulo', () => {
    const rainEnd = changeText(pt, 'pt', aviso('mudou_fim_chuvas', { antes: '04-24', recente: '04-13', diferenca_dias: -11 }), PERIODO)
    const shortage = changeText(
      pt,
      'pt',
      aviso('mudou_falta_agua', { antes: 101.6, recente: 177.4, cultura: 'milho_braquiaria', nome: 'Milho com braquiária' }),
      PERIODO,
    )
    const worked = changeText(
      en,
      'en',
      aviso('mudou_deu_certo', { antes_bons: 13, antes_total: 15, recente_bons: 3, recente_total: 5, cultura: 'milho_braquiaria' }),
      PERIODO,
    )

    expect(rainEnd).toMatchObject({
      label: 'Fim das chuvas',
      before: '24 de abr',
      after: '13 de abr',
      worse: true,
      meaning: 'A chuva do outono terminou, em média, 11 dias mais cedo em 2020–2024 do que em 2005–2019.',
      guide: 'quando-a-chuva-acaba',
    })
    expect(shortage).toMatchObject({
      label: 'Falta de água · milho com braquiária',
      before: '101,6 mm',
      after: '177,4 mm',
      guide: 'conta-de-agua',
    })
    expect(worked).toMatchObject({
      label: 'Worked · corn with brachiaria',
      before: '13 of 15',
      after: '3 of 5',
      worse: true,
      meaning: 'Corn with brachiaria worked in 3 of 5 years in 2020–2024; in 13 of 15 years in 2005–2019.',
      guide: 'deu-certo',
    })
  })

  it('mudança para melhor não fica laranja e diz para não contar com ela', () => {
    const better = changeText(pt, 'pt', aviso('mudou_calor', { antes: 2, recente: 0.5, temp_c: 35 }), PERIODO)

    expect(better).toMatchObject({ label: 'Dias de 35 °C ou mais (mar–mai)', before: '2 dias', after: '0,5 dias', worse: false })
    expect(better?.todo).toBe('Mudou para melhor, mas são poucos anos: não conte com isso.')
  })

  it('os períodos do quadro: "2005–19 → 2020–24"', () => {
    expect(periodsLabel(PERIODO)).toBe('2005–19 → 2020–24')
  })
})

describe('alertTexts: "Já aconteceu aqui"', () => {
  it('os 4 recordes com o número grande e a frase curta', () => {
    const [dry, autumn, rainEnd, heat] = buildAvisos({ lat: -18.9, lon: -48.2 }, 'pt').recordes!.avisos.map((a) =>
      recordText(pt, 'pt', a, PERIODO),
    )

    expect(dry).toMatchObject({
      label: 'Maior veranico',
      value: '43 dias',
      caption: 'seguidos sem chuva, a partir de 19 de abr de 2024',
      title: 'Maior veranico',
      number: '43 dias',
      meaning: '43 dias seguidos sem chuva, a partir de 19 de abr de 2024. Foi o mais extremo de 2005 a 2024 na sua área.',
      todo: 'Já aconteceu aqui e pode voltar. Prefira um plano que aguente um ano assim, como o Plano B do seu plano de 3 anos.',
      guide: 'veranico',
    })
    expect(autumn).toMatchObject({ label: 'Outono mais seco', value: '178 mm', caption: 'de março a maio de 2021 (a média é 330,7 mm)' })
    expect(rainEnd).toMatchObject({ label: 'Chuva acabou mais cedo', value: '16 de mar', caption: 'em 2021' })
    expect(heat).toMatchObject({ label: 'Ano com mais calor', value: '3 dias', caption: 'com 35 °C ou mais de março a maio de 2024' })
  })

  it('em inglês', () => {
    const dry = recordText(en, 'en', buildAvisos({ lat: -18.9, lon: -48.2 }, 'en').recordes!.avisos[0], PERIODO)

    expect(dry).toMatchObject({ label: 'Longest dry spell', value: '43 days', caption: 'in a row without rain, from Apr 19, 2024' })
  })
})

describe('alertTexts: topo, plano, exemplo e "Ouvir resumo"', () => {
  it('o lugar: a lavoura de demonstração tem nome; as outras, a cidade mais perto', () => {
    expect(placeLabel(pt, 'Uberlândia (MG)', true)).toBe('Lavoura de demonstração, perto de Uberlândia (MG)')
    expect(placeLabel(pt, 'Prata (MG)', false)).toBe('Lavoura perto de Prata (MG)')
    expect(placeLabel(en, 'Prata (MG)', false)).toBe('Field near Prata (MG)')
    expect(placeLabel(pt, null, false)).toBeNull()
  })

  it('datas curtas dos quadros: "24 de abr" / "Apr 24"', () => {
    expect(shortDate('pt', '2027-03-20')).toBe('20 de mar')
    expect(shortDate('en', '2027-03-20')).toBe('Mar 20')
  })

  it('"Seu plano": a cultura, o prazo do ZARC (sem prazo, a frase fica sem ele) e o "deixar parado"', () => {
    expect(planText(pt, 'pt', { crop: 'sorgo', deadline: '2027-03-20', late: false })).toBe(
      'Seu plano: **sorgo**, plantio até 20 de mar. Durante o ciclo, aparecem aqui os avisos de veranico e de calor na floração.',
    )
    expect(planText(pt, 'pt', { crop: 'milho_braquiaria', deadline: null, late: false })).toBe(
      'Seu plano: **milho com braquiária**. Durante o ciclo, aparecem aqui os avisos de veranico e de calor na floração.',
    )
    expect(planText(pt, 'pt', { crop: 'milho_safrinha', deadline: '2027-02-28', late: true })).toBe(
      'Seu plano: **milho sozinho**, mas já passou do prazo de plantio do ZARC (28 de fev). Durante o ciclo, aparecem aqui os avisos de veranico e de calor na floração.',
    )
    expect(planText(en, 'en', { crop: 'sorgo', deadline: '2027-03-20', late: false })).toBe(
      'Your plan: **sorghum**, plant by Mar 20. During the season, dry-spell and flowering-heat alerts show up here.',
    )
    expect(planText(pt, 'pt', { crop: 'pousio', deadline: null, late: false })).toBe('Seu plano: **deixar a terra parada** depois da soja.')
  })

  it('as linhas do exemplo: o aviso do replay com o dia em que parou de chover e os recordes daquele ano', () => {
    const records = buildAvisos({ lat: -18.9, lon: -48.2 }, 'pt').recordes!.avisos
    const replay = {
      kind: 'replay' as const,
      tipo: 'aviso_veranico' as const,
      date: '2024-04-28',
      texto: 'Aviso: 10 dias sem chuva perto da fase que mais precisa de água. Converse com o agrônomo.',
      since: '2024-04-19',
    }

    expect(exampleRowText(pt, 'pt', replay, PERIODO)).toEqual({
      when: '28 de abr',
      level: 'atencao',
      text: 'Aviso: 10 dias sem chuva perto da fase que mais precisa de água. Converse com o agrônomo. O veranico tinha começado em 19 de abril.',
    })
    expect(exampleRowText(pt, 'pt', { kind: 'record', aviso: records[0] }, PERIODO)).toEqual({
      when: '19 de abr',
      level: 'fique_de_olho',
      text: 'Começou um veranico de 43 dias seguidos sem chuva, o maior de março a maio desde 2005.',
    })
    expect(exampleRowText(pt, 'pt', { kind: 'record', aviso: records[3] }, PERIODO)).toEqual({
      when: 'mar–mai',
      level: 'fique_de_olho',
      text: '3 dias com 35 °C ou mais de março a maio, o ano com mais calor desde 2005. Na floração, calor forte derruba as flores.',
    })
  })

  it('"Ouvir resumo": sem aviso, com avisos (título e o que fazer de cada um) e sem ponto', () => {
    const avisos = buildAvisos({ lat: -18.9, lon: -48.2 }, 'pt')
    const none = { ...avisos, contador: 0, agora: { avisos: [], ultima_leitura: null } }

    expect(alertsListen(pt, 'pt', alertsSummary(none), [])).toBe(
      'Nada fora do normal agora na sua lavoura. Os avisos aparecem aqui quando algo mudar.',
    )
    expect(alertsListen(pt, 'pt', alertsSummary(avisos), nowAlerts(avisos))).toBe(
      'Você tem 2 avisos agora. A terra está mais seca que o normal: confira a umidade da terra antes de plantar ou adubar. El Niño previsto para fevereiro a abril de 2027: confira o sinal em fevereiro, antes de plantar. Para alertas oficiais, use o SMS 40199 com o seu CEP.',
    )
    expect(alertsListen(en, 'en', alertsSummary(avisos), nowAlerts(avisos))).toMatch(
      /^You have 2 alerts now\. The soil is drier than normal: check soil moisture before planting or fertilizing\. .* For official alerts, text your ZIP code to 40199\.$/,
    )
    expect(alertsListen(pt, 'pt', null, [])).toBe(pt.alerts.listen.waiting)
  })
})
