import { describe, expect, it } from 'vitest'
import type { Historico } from '../models/talhao'
import {
  answeredCount,
  confirmadasFromAnswers,
  currentChoiceCrop,
  formatCurrentChoice,
  flowWithSeasonAnswers,
  formatSeasonAnswers,
  nextAfterAnswer,
  nextSoyAnswer,
  parseCurrentChoice,
  parseSeasonAnswers,
  seasonAnswersFromFlow,
  seasonAnswersFromLegacy,
  seasonRows,
  soyState,
  todayCrops,
  withSeasonAnswer,
} from './seasonAnswersService'

describe('ler e escrever as respostas (parâmetro safras)', () => {
  it('lê ano:resposta, com cultura, soja e sem_soja', () => {
    expect(parseSeasonAnswers('2024:milho_braquiaria,2025:pousio,2026:sem_soja')).toEqual({
      2024: 'milho_braquiaria',
      2025: 'pousio',
      2026: 'sem_soja',
    })
    expect(parseSeasonAnswers('2025:soja')).toEqual({ 2025: 'soja' })
  })

  it('pedaço fora do formato ou valor desconhecido fica de fora', () => {
    expect(parseSeasonAnswers('2024:feijao,25:sorgo,2026:sorgo,lixo')).toEqual({ 2026: 'sorgo' })
    expect(parseSeasonAnswers(null)).toEqual({})
    expect(parseSeasonAnswers('')).toEqual({})
  })

  it('escreve em ordem de ano e some sem nenhuma resposta', () => {
    expect(formatSeasonAnswers({ 2026: 'sem_soja', 2024: 'milho_braquiaria', 2025: 'pousio' })).toBe(
      '2024:milho_braquiaria,2025:pousio,2026:sem_soja',
    )
    expect(formatSeasonAnswers({})).toBeUndefined()
  })

  it('marca e desmarca a resposta de um ano', () => {
    expect(withSeasonAnswer({ 2024: 'sorgo' }, 2025, 'pousio')).toEqual({ 2024: 'sorgo', 2025: 'pousio' })
    expect(withSeasonAnswer({ 2024: 'sorgo', 2025: 'pousio' }, 2024, null)).toEqual({ 2025: 'pousio' })
  })
})

describe('escolha atual (parâmetro pensa, safra 2026/27)', () => {
  it('lê uma cultura ou "nao_sei"; o resto vira indefinido', () => {
    expect(parseCurrentChoice('sorgo')).toBe('sorgo')
    expect(parseCurrentChoice('pousio')).toBe('pousio')
    expect(parseCurrentChoice('nao_sei')).toBe('nao_sei')
    expect(parseCurrentChoice('soja')).toBeUndefined()
    expect(parseCurrentChoice(null)).toBeUndefined()
  })

  it('escreve igual', () => {
    expect(formatCurrentChoice('milheto')).toBe('milheto')
    expect(formatCurrentChoice(undefined)).toBeUndefined()
  })

  it('a cultura da escolha atual: "Ainda não sei" e sem resposta = nenhuma (a tela usa a sugestão)', () => {
    expect(currentChoiceCrop('crotalaria')).toBe('crotalaria')
    expect(currentChoiceCrop('nao_sei')).toBeNull()
    expect(currentChoiceCrop(undefined)).toBeNull()
  })
})

describe('quantas safras foram respondidas', () => {
  it('conta cultura e "Não plantei"; só "Plantei" sem o depois ainda falta', () => {
    expect(answeredCount({ 2024: 'milho_braquiaria', 2025: 'soja', 2026: 'sem_soja' })).toBe(2)
    expect(answeredCount({})).toBe(0)
  })

  it('só conta as safras pedidas (as 3 últimas, por padrão)', () => {
    expect(answeredCount({ 2020: 'sorgo', 2024: 'sorgo' })).toBe(1)
    expect(answeredCount({ 2020: 'sorgo', 2024: 'sorgo' }, [2020])).toBe(1)
  })
})

describe('confirmadas que a API aceita hoje', () => {
  it('outra cultura = plantou, pousio = parado; soja e sem_soja ficam sem confirmação', () => {
    expect(confirmadasFromAnswers({ 2024: 'milho_braquiaria', 2025: 'pousio', 2026: 'soja' })).toBe(
      '2024:plantou,2025:parado',
    )
    expect(confirmadasFromAnswers({ 2026: 'sem_soja' })).toBeUndefined()
    expect(confirmadasFromAnswers({})).toBeUndefined()
  })
})

describe('culturas do "como é hoje" para o /api/plano', () => {
  it('as 3 últimas safras, em ordem, quando todas têm a cultura (o pousio vale)', () => {
    expect(todayCrops({ 2026: 'sorgo', 2024: 'milho_braquiaria', 2025: 'pousio' })).toEqual([
      'milho_braquiaria',
      'pousio',
      'sorgo',
    ])
  })

  it('faltou alguma (ou foi soja sem o depois, ou sem soja) = null: "não preenchido"', () => {
    expect(todayCrops({ 2024: 'milho_braquiaria', 2025: 'pousio' })).toBeNull()
    expect(todayCrops({ 2024: 'milho_braquiaria', 2025: 'pousio', 2026: 'soja' })).toBeNull()
    expect(todayCrops({ 2024: 'milho_braquiaria', 2025: 'pousio', 2026: 'sem_soja' })).toBeNull()
  })
})

describe('links antigos (confirmadas e hoje)', () => {
  it('a cultura do "hoje" vale; senão, parado = pousio e plantou = soja', () => {
    expect(seasonAnswersFromLegacy('2024:plantou,2025:parado,2026:plantou', '2026:sorgo')).toEqual({
      2024: 'soja',
      2025: 'pousio',
      2026: 'sorgo',
    })
    expect(seasonAnswersFromLegacy(null, '2024:milheto')).toEqual({ 2024: 'milheto' })
    expect(seasonAnswersFromLegacy(undefined, undefined)).toEqual({})
  })
})

describe('respostas no fluxo (URL)', () => {
  const flow = { lat: 1, lon: 2 }

  it('lê o safras; sem ele, os parâmetros antigos (links velhos)', () => {
    expect(seasonAnswersFromFlow({ ...flow, safras: '2024:sorgo', confirmadas: '2025:parado' })).toEqual({ 2024: 'sorgo' })
    expect(seasonAnswersFromFlow({ ...flow, confirmadas: '2025:parado', hoje: '2024:milheto' })).toEqual({
      2024: 'milheto',
      2025: 'pousio',
    })
    expect(seasonAnswersFromFlow(null)).toEqual({})
  })

  it('grava as respostas no fluxo e tira o confirmadas e o hoje antigos, para não ficarem duas versões', () => {
    expect(
      flowWithSeasonAnswers({ ...flow, colheita: 'meio', confirmadas: '2025:parado', hoje: '2024:milheto' }, { 2024: 'sorgo' }),
    ).toEqual({ ...flow, colheita: 'meio', confirmadas: undefined, hoje: undefined, safras: '2024:sorgo' })
    expect(flowWithSeasonAnswers({ ...flow, safras: '2024:sorgo' }, {}).safras).toBeUndefined()
  })
})

describe('Plantei / Não plantei e o "depois da soja"', () => {
  const seen = { soy: true, after: 'plantou' as const, ndvi: 0.71 }

  it('a soja aparece marcada pela resposta ou, sem ela, pelo satélite', () => {
    expect(soyState('sorgo', null)).toBe('sim')
    expect(soyState('soja', null)).toBe('sim')
    expect(soyState('sem_soja', seen)).toBe('nao')
    expect(soyState(undefined, seen)).toBe('sim')
    expect(soyState(undefined, { ...seen, soy: false })).toBeNull()
    expect(soyState(undefined, null)).toBeNull()
  })

  it('tocar em "Plantei" marca a soja; tocar de novo volta para o satélite (tira o depois junto)', () => {
    expect(nextSoyAnswer(undefined, 'sim')).toBe('soja')
    expect(nextSoyAnswer('sem_soja', 'sim')).toBe('soja')
    expect(nextSoyAnswer('soja', 'sim')).toBeNull()
    expect(nextSoyAnswer('sorgo', 'sim')).toBeNull()
  })

  it('"Não plantei" troca tudo por sem_soja; tocar de novo desmarca', () => {
    expect(nextSoyAnswer('sorgo', 'nao')).toBe('sem_soja')
    expect(nextSoyAnswer(undefined, 'nao')).toBe('sem_soja')
    expect(nextSoyAnswer('sem_soja', 'nao')).toBeNull()
  })

  it('escolher o depois marca a soja junto; tocar de novo na mesma cultura tira só o depois', () => {
    expect(nextAfterAnswer(undefined, 'sorgo')).toBe('sorgo')
    expect(nextAfterAnswer('soja', 'pousio')).toBe('pousio')
    expect(nextAfterAnswer('milheto', 'sorgo')).toBe('sorgo')
    expect(nextAfterAnswer('sorgo', 'sorgo')).toBe('soja')
  })
})

describe('linhas do formulário a partir do talhão', () => {
  const historico: Historico = {
    anos: [
      { ano: 2023, situacao: 'plantou', ndvi_max: 0.8, n_obs: 9 },
      { ano: 2024, situacao: 'plantou', ndvi_max: 0.71, n_obs: 9 },
      { ano: 2025, situacao: 'parado', ndvi_max: 0.32, n_obs: 8 },
      { ano: 2026, situacao: 'sem_soja', ndvi_max: null, n_obs: 3 },
    ],
    parado: 1,
    plantou: 2,
    sem_certeza: 0,
    sem_soja: 1,
    total: 4,
    fonte: 'MODIS',
    janela: '04-01 a 07-31',
  }

  it('uma linha por safra pedida, com o que o satélite viu', () => {
    expect(seasonRows(historico)).toEqual([
      { year: 2024, satellite: { soy: true, after: 'plantou', ndvi: 0.71 } },
      { year: 2025, satellite: { soy: true, after: 'parado', ndvi: 0.32 } },
      { year: 2026, satellite: { soy: false, after: null, ndvi: null } },
    ])
  })

  it('incerto = viu a soja, sem certeza do depois; sem dado ou sem o ano = sem leitura', () => {
    const other: Historico = {
      ...historico,
      anos: [
        { ano: 2024, situacao: 'incerto', ndvi_max: 0.5, n_obs: 2 },
        { ano: 2025, situacao: 'sem_dado', ndvi_max: null, n_obs: 0 },
      ],
    }
    expect(seasonRows(other)).toEqual([
      { year: 2024, satellite: { soy: true, after: null, ndvi: 0.5 } },
      { year: 2025, satellite: null },
      { year: 2026, satellite: null },
    ])
  })

  it('sem histórico do satélite: as 3 linhas sem leitura', () => {
    expect(seasonRows(null)).toEqual([
      { year: 2024, satellite: null },
      { year: 2025, satellite: null },
      { year: 2026, satellite: null },
    ])
  })
})
