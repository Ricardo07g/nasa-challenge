import { describe, expect, it } from 'vitest'
import * as format from './format'
import {
  formatCoordinates,
  formatDayMonth,
  formatDecimal,
  formatFullDate,
  formatMonth,
  formatNumber,
} from './format'

describe('format', () => {
  it('não formata reais: nenhum valor em reais no produto (tarefa 0040)', () => {
    expect('formatCurrency' in format).toBe(false)
    expect('formatApproxMoney' in format).toBe(false)
  })

  it('mostra as coordenadas do ponto com 4 casas, latitude primeiro', () => {
    expect(formatCoordinates({ lat: -18.92, lon: -48.28 })).toBe('-18.9200, -48.2800')
  })

  it('número com casas decimais no jeito de cada idioma', () => {
    expect(formatDecimal('pt', -18.9543, 2)).toBe('-18,95')
    expect(formatDecimal('en', -48.1993, 2)).toBe('-48.20')
  })

  it('data por extenso, com o ano, sem depender do fuso', () => {
    expect(formatFullDate('pt', '2026-11-14')).toBe('14 de novembro de 2026')
    expect(formatFullDate('en', '2026-11-14')).toBe('November 14, 2026')
  })

  it('formata números com o separador do idioma', () => {
    expect(formatNumber('pt', 1250)).toBe('1.250')
    expect(formatNumber('en', 1250)).toBe('1,250')
  })

  it('formata dia e mês sem depender do fuso horário', () => {
    expect(formatDayMonth('pt', '2027-02-18')).toBe('18 de fevereiro')
    expect(formatDayMonth('en', '2027-02-18')).toBe('February 18')
  })
})

describe('formatMonth', () => {
  it('nome do mês por extenso no jeito do idioma (1 = janeiro)', () => {
    expect(formatMonth('pt', 4)).toBe('abril')
    expect(formatMonth('pt', 7)).toBe('julho')
    expect(formatMonth('en', 4)).toBe('April')
  })
})

describe('datas do cartão "Dia da colheita" (tela 2, tarefa 0057)', () => {
  it('mês curto do calendário, em maiúsculas e sem ponto', () => {
    expect(format.formatCalendarMonth('pt', '2027-03-03')).toBe('MAR')
    expect(format.formatCalendarMonth('pt', '2027-02-15')).toBe('FEV')
    expect(format.formatCalendarMonth('en', '2027-02-15')).toBe('FEB')
  })

  it('dia da semana por extenso, com a primeira letra maiúscula, sem depender do fuso', () => {
    expect(format.formatWeekday('pt', '2027-03-03')).toBe('Quarta-feira')
    expect(format.formatWeekday('en', '2027-03-03')).toBe('Wednesday')
  })

  it('dia e mês curtos para gráficos ("16 mar" / "Mar 16")', () => {
    expect(format.formatShortDayMonth('pt', '2021-03-16')).toBe('16 mar')
    expect(format.formatShortDayMonth('en', '2021-03-16')).toBe('Mar 16')
    expect(format.formatShortDayMonth('pt', '2027-02-01')).toBe('1 fev')
  })
})
