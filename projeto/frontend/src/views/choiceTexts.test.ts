import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages.en'
import { pt } from '../i18n/messages.pt'
import type { Opcao } from '../models/recomendacao'
import { buildRecomendacao } from '../repositories/mocks/fixtures'
import { consTexts, deadlineCellText } from './choiceTexts'

const point = { lat: -18.9543, lon: -48.1993 }

function late(id: Opcao['id'], prazoZarc?: boolean): Opcao {
  const option = buildRecomendacao({ ...point, colheita: 'tarde' }, 'pt').opcoes.find((item) => item.id === id)!
  return { ...option, na_janela: false, fora_do_prazo: true, data_limite: '2027-02-28', prazo_zarc: prazoZarc }
}

describe('consTexts ("Contra" de cada opção)', () => {
  it('passou do prazo do ZARC: o risco sobe e o seguro pode não cobrir (tarefa 0066 do backend)', () => {
    expect(consTexts(pt, 'pt', late('milho_safrinha'))[0]).toBe('Passou do prazo do ZARC (28 de fevereiro): o risco sobe e o seguro pode não cobrir')
    expect(consTexts(en, 'en', late('milho_safrinha', true))[0]).toBe(
      'Past the ZARC deadline (February 28): the risk goes up and insurance may not cover it',
    )
  })

  it('a crotalária não tem ZARC: "passou da data sugerida", sem ZARC nem seguro', () => {
    expect(consTexts(pt, 'pt', late('crotalaria', false))[0]).toBe('Passou da data sugerida (28 de fevereiro)')
    expect(consTexts(en, 'en', late('crotalaria', false))[0]).toBe('Past the suggested date (February 28)')
  })
})

describe('deadlineCellText (o modal da célula do prazo)', () => {
  it('com ZARC, a frase do ZARC; sem ZARC (crotalária), a data sugerida pelo app', () => {
    expect(deadlineCellText(pt, late('milho_safrinha'), '28 de fevereiro de 2027', '3 de março', true)).toBe(
      pt.choose.cell.deadlineLate('28 de fevereiro de 2027', '3 de março'),
    )
    expect(deadlineCellText(pt, late('crotalaria', false), '28 de fevereiro de 2027', '3 de março', true)).toBe(
      pt.choose.cell.deadlineSuggestedLate('28 de fevereiro de 2027', '3 de março'),
    )
    expect(deadlineCellText(en, late('crotalaria', false), 'February 28, 2027', 'February 18', false)).toBe(
      en.choose.cell.deadlineSuggestedOk('February 28, 2027', 'February 18'),
    )
    expect(deadlineCellText(pt, late('sorgo'), null, '3 de março', false)).toBe(pt.choose.cell.deadlineNone)
  })
})
