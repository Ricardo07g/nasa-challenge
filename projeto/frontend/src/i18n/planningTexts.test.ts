import { describe, expect, it } from 'vitest'
import type { TimelineStep } from '../services/planningService'
import { en } from './messages.en'
import { pt } from './messages.pt'
import { gainText, planDeadlineText, planningAlertText, planningSummary, scenarioName, stepText } from './planningTexts'

const signal: TimelineStep = {
  kind: 'signal',
  year: 2027,
  forecast: 'Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA).',
  planA: 'sorgo',
  planB: { kind: 'b', crop: 'milheto', name: 'Milheto', good: 9, fails: 9 },
  tag: 'milheto',
}

const plant: Extract<TimelineStep, { kind: 'plant' }> = {
  kind: 'plant',
  crop: 'sorgo',
  sowing: '2027-03-03',
  deadline: '2027-03-20',
  late: false,
  zarc: true,
}

describe('stepText (as frases de cada passo de "O que fazer agora")', () => {
  it('agora: de hoje até a colheita, com a etiqueta "agora"', () => {
    expect(stepText(pt, 'pt', { kind: 'now', from: '2026-11-15', to: '2027-03-03' })).toEqual({
      when: 'Agora',
      sub: 'nov–mar',
      title: 'Cuide da soja e fique de olho nos avisos',
      text: 'Os avisos de calor, veranico e terra seca aparecem no sino lá em cima.',
      tag: { kind: 'now', label: 'agora' },
      late: false,
    })
  })

  it('fevereiro: a previsão da NOAA e o Plano B do motor, com a etiqueta azul', () => {
    expect(stepText(pt, 'pt', signal)).toMatchObject({
      when: 'Fevereiro',
      sub: '2027',
      text: 'Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA). Se em fevereiro o sinal for de ano seco e a terra estiver seca, troque para o Plano B: milheto.',
      tag: { kind: 'planB', label: 'Plano B: milheto' },
    })
    expect(stepText(en, 'en', signal).tag).toEqual({ kind: 'planB', label: 'Plan B: pearl millet' })
  })

  it('fevereiro sem previsão e sem etiqueta: confira o sinal; sem Plano B porque nunca falhou', () => {
    const text = stepText(pt, 'pt', {
      ...signal,
      forecast: null,
      planA: 'milheto',
      planB: { kind: 'notNeeded', reason: 'nunca_falhou' },
      tag: null,
    })
    expect(text.text).toBe(
      'Em fevereiro, confira de novo o sinal e a umidade da terra (SMAP) antes de plantar. Não precisa de Plano B: milheto deu certo em todos os anos.',
    )
    expect(text.tag).toBeNull()
  })

  it('colheita, plantio até o prazo do ZARC e o aviso de fora do prazo', () => {
    expect(stepText(pt, 'pt', { kind: 'harvest', date: '2027-03-03' })).toMatchObject({ when: '3 mar', sub: 'colheita', title: 'Colha a soja' })
    expect(stepText(pt, 'pt', plant)).toMatchObject({
      when: 'até 20 mar',
      sub: 'prazo ZARC',
      title: 'Plante sorgo',
      text: 'Plante logo depois de colher: o prazo do ZARC vai até 20 de março. Depois disso, o risco sobe e o seguro rural pode não cobrir.',
      late: false,
    })
    const late = stepText(pt, 'pt', { ...plant, crop: 'milho_braquiaria', deadline: '2027-02-10', late: true })
    expect(late).toMatchObject({
      when: 'até 10 fev',
      late: true,
      text: 'Passou do prazo do ZARC (10 de fevereiro): o risco sobe e o seguro rural pode não cobrir.',
    })
    expect(stepText(en, 'en', { ...plant, deadline: '2027-02-10', late: true }).text).toBe(
      'Past the ZARC deadline (February 10): the risk goes up and crop insurance may not cover it.',
    )
  })

  it('a crotalária não tem ZARC (tarefa 0066 do backend): a data é sugerida, sem falar em ZARC nem em seguro', () => {
    const crot = { ...plant, crop: 'crotalaria', deadline: '2027-02-28', zarc: false } as const
    expect(stepText(pt, 'pt', crot)).toMatchObject({
      sub: 'data sugerida',
      text: 'Plante logo depois de colher, até 28 de fevereiro: data sugerida pelo app (não há ZARC para esta planta).',
    })
    expect(stepText(pt, 'pt', { ...crot, late: true }).text).toBe('Passou da data sugerida (28 de fevereiro).')
    expect(stepText(en, 'en', { ...crot, late: true }).text).toBe('Past the suggested date (February 28).')
    const next = { kind: 'next', year: 2027, crop: 'crotalaria', deadline: '2028-02-28', late: false, zarc: false } as const
    expect(stepText(pt, 'pt', next).text).toBe(
      'Plante até 28 de fevereiro (data sugerida). Abra o app de novo depois da colheita de 2028 para conferir o plano com a chuva daquele ano.',
    )
    expect(stepText(pt, 'pt', { ...next, late: true }).text).toMatch(/^Passou da data sugerida \(28 de fevereiro\)\./)
  })

  it('a fase da água (floração ou pegamento), a colheita da cultura e a próxima soja', () => {
    expect(
      stepText(pt, 'pt', { kind: 'water', crop: 'sorgo', phase: 'floracao', from: '2027-04-22', to: '2027-05-22', flowerDays: 65, windowDays: 15 }),
    ).toMatchObject({
      when: 'abr–mai',
      sub: 'floração',
      title: 'Fase em que a planta mais precisa de água',
      text: 'É quando o veranico mais prejudica: a floração vem por volta de 65 dias depois do plantio.',
    })
    expect(
      stepText(pt, 'pt', { kind: 'water', crop: 'milheto', phase: 'pegamento', from: '2027-03-03', to: '2027-04-02', flowerDays: 50, windowDays: 30 })
        .text,
    ).toBe('Nos primeiros 30 dias depois do plantio, a planta precisa de água para pegar.')
    expect(stepText(pt, 'pt', { kind: 'cropHarvest', crop: 'sorgo', grain: true, date: '2027-06-26' })).toMatchObject({
      when: 'jun',
      sub: '2027',
      title: 'Colha e deixe a palha no chão',
    })
    expect(stepText(pt, 'pt', { kind: 'cropHarvest', crop: 'milheto', grain: false, date: '2027-06-01' }).title).toBe('Deixe a palha no chão')
    const next = { kind: 'next', year: 2027, crop: 'milheto', deadline: null, late: false, zarc: true } as const
    expect(stepText(pt, 'pt', next)).toMatchObject({
      when: 'out–nov',
      sub: '2027',
      title: 'Próxima soja; depois dela, milheto',
      text: 'Abra o app de novo depois da colheita de 2028 para conferir o plano com a chuva daquele ano.',
      late: false,
    })
    expect(stepText(en, 'en', next).title).toBe('Next soybeans; after them, pearl millet')
    // Tarefa 0065: o prazo do ZARC do 2º ano, no mesmo passo (sem passo novo)
    expect(stepText(pt, 'pt', { ...next, deadline: '2028-03-15' }).text).toBe(
      'Plante até 15 de março (prazo do ZARC). Abra o app de novo depois da colheita de 2028 para conferir o plano com a chuva daquele ano.',
    )
    expect(stepText(pt, 'pt', { ...next, deadline: '2028-02-28', late: true })).toMatchObject({
      text: 'Passou do prazo do ZARC (28 de fevereiro): o risco sobe e o seguro rural pode não cobrir. Abra o app de novo depois da colheita de 2028 para conferir o plano com a chuva daquele ano.',
      late: true,
    })
    expect(stepText(en, 'en', { ...next, deadline: '2028-03-15' }).text).toBe(
      "Plant by March 15 (ZARC deadline). Open the app again after the 2028 harvest to check the plan with that year's rain.",
    )
  })
})

describe('planningAlertText (os cartões dos alertas)', () => {
  it('Agora, chuva forte e fogo, com "O que fazer" e a fonte', () => {
    expect(
      planningAlertText(pt, 'pt', { kind: 'now', forecast: 'Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA).', source: 'NOAA', date: '2026-11-12' }),
    ).toEqual({
      label: 'Agora',
      text: 'Previsão para fevereiro a abril de 2027: El Niño (98%, NOAA).',
      todo: 'confira o sinal em fevereiro, antes de plantar.',
      source: 'NOAA, 12 de novembro de 2026',
    })
    expect(
      planningAlertText(pt, 'pt', { kind: 'heavyRain', data: { media_dias_ano: 0.25, dias: 5, total_anos: 20, limite_mm: 50, fonte: 'gpm_imerg' } }).text,
    ).toBe('Em 20 anos, houve 5 dias com 50 mm ou mais de chuva em fevereiro e março.')
    expect(
      planningAlertText(en, 'en', { kind: 'fire', data: { anos: [2016, 2018, 2019, 2020, 2024], total_anos: 10, raio_km: 5, fonte: 'MODIS' } }),
    ).toEqual({
      label: 'Fire',
      text: 'There was fire within 5 km of your spot in 5 of the last 10 years.',
      todo: 'keep firebreaks and do not burn the straw.',
      source: 'MODIS (NASA)',
    })
  })
})

describe('gainText ("Como o plano ajuda a ganhar")', () => {
  const gain = {
    income: [{ crop: 'sorgo' as const, seasons: [2027, 2029] }],
    covers: [{ crop: 'crotalaria' as const, season: 2028, straw: true, nitrogen: true, nematode: true }],
    planB: { from: 'sorgo' as const, to: 'milheto' as const },
  }

  it('renda, o que as coberturas devolvem e o Plano B, em pt e en', () => {
    // Tarefa 0066 do backend: "deixa nitrogênio na terra" (a soja inoculada tira o seu do ar) e "ajuda a baixar o
    // nematoide" (Debiasi et al. 2016: a diferença some na colheita da soja).
    expect(gainText(pt, gain)).toBe(
      'Sorgo dá grão para vender em 2026/27 e 2028/29. Crotalária, em 2027/28, não dá grão, mas deixa palha que protege a terra, deixa nitrogênio na terra e ajuda a baixar o nematoide: isso ajuda a soja seguinte. Plano B: se o outono vier seco, trocar sorgo por milheto.',
    )
    expect(gainText(en, gain)).toBe(
      'Sorghum gives grain to sell in 2026/27 and 2028/29. Crotalaria, in 2027/28, gives no grain, but leaves straw that protects the soil, adds nitrogen to the soil and helps lower nematodes: this helps the next soybeans. Plan B: if autumn looks dry, swap sorghum for pearl millet.',
    )
  })

  it('sem grão em nenhum ano', () => {
    expect(gainText(pt, { income: [], covers: [], planB: null })).toBe(
      'Nenhum ano do plano dá grão para vender: o ganho vem na terra e na soja seguinte.',
    )
  })
})

describe('planningSummary ("Ouvir resumo" da tela 6)', () => {
  const base = { crops: ['sorgo', 'milheto', 'sorgo'] as const, harvest: '2027-03-03', plant, planB: 'milheto' as const }

  it('o plano, a colheita e o prazo, e o Plano B (o texto do prompt)', () => {
    expect(planningSummary(pt, 'pt', base)).toBe(
      'Seu plano: sorgo depois da soja de 2026/27, milheto em 2027/28 e sorgo em 2028/29. Colha a soja por volta de 3 de março e plante sorgo até 20 de março. Em fevereiro, confira o sinal do outono: se o ano vier seco, troque para milheto.',
    )
    expect(planningSummary(en, 'en', base)).toBe(
      'Your plan: sorghum after the 2026/27 soybeans, pearl millet in 2027/28 and sorghum in 2028/29. Harvest the soybeans around March 3 and plant sorghum by March 20. In February, check the autumn signal: if the year looks dry, switch to pearl millet.',
    )
  })

  it('fora do prazo, sem Plano B e com o 1º ano parado', () => {
    expect(planningSummary(pt, 'pt', { ...base, plant: { ...plant, deadline: '2027-02-28', late: true }, planB: null })).toBe(
      'Seu plano: sorgo depois da soja de 2026/27, milheto em 2027/28 e sorgo em 2028/29. Colha a soja por volta de 3 de março e plante sorgo logo depois; o prazo do ZARC acabou em 28 de fevereiro. Em fevereiro, confira o sinal do outono.',
    )
    expect(planningSummary(pt, 'pt', { ...base, crops: ['pousio', 'milheto', 'sorgo'], plant: null, planB: null })).toContain(
      'Colha a soja por volta de 3 de março. Em fevereiro',
    )
    // A crotalária não tem ZARC (tarefa 0066 do backend)
    const crot = { ...plant, crop: 'crotalaria', deadline: '2027-02-28', late: true, zarc: false } as const
    expect(planningSummary(pt, 'pt', { ...base, crops: ['crotalaria', 'milheto', 'sorgo'], plant: crot, planB: null })).toContain(
      'plante crotalária logo depois; a data sugerida acabou em 28 de fevereiro.',
    )
  })
})

describe('planDeadlineText (coluna "Prazo" do plano no relatório, tarefa 0065)', () => {
  it('o prazo do ZARC de cada ano; passou do prazo, avisa; o pousio não tem prazo; sem o dado, um traço', () => {
    expect(planDeadlineText(pt, 'pt', { crop: 'sorgo', deadline: '2028-03-20', late: false })).toBe('Até 20 de março')
    expect(planDeadlineText(pt, 'pt', { crop: 'milho_safrinha', deadline: '2027-02-28', late: true })).toBe('Passou do prazo (28 de fevereiro)')
    expect(planDeadlineText(pt, 'pt', { crop: 'pousio', deadline: null, late: false })).toBe('Sem prazo')
    expect(planDeadlineText(pt, 'pt', { crop: 'sorgo', deadline: null, late: false })).toBe('—')
    expect(planDeadlineText(en, 'en', { crop: 'sorgo', deadline: '2028-03-20', late: false })).toBe('By March 20')
  })
})

describe('scenarioName', () => {
  it('ssp245 vira SSP2-4.5', () => {
    expect(scenarioName('ssp245')).toBe('SSP2-4.5')
    expect(scenarioName('outro')).toBe('outro')
  })
})
