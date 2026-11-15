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
