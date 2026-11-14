import { describe, expect, it } from 'vitest'
import { formatApproxMoney, formatCoordinates, formatCurrency, formatDayMonth, formatDecimal, formatNumber } from './format'

const normalize = (text: string) => text.replace(/\s/g, ' ')

describe('format', () => {
  it('formata reais sem centavos nos dois idiomas', () => {
    expect(normalize(formatCurrency('pt', 700))).toBe('R$ 700')
    expect(normalize(formatCurrency('pt', 1250))).toBe('R$ 1.250')
    expect(normalize(formatCurrency('en', 1250))).toBe('R$1,250')
  })

  it('mostra as coordenadas do ponto com 4 casas, latitude primeiro', () => {
    expect(formatCoordinates({ lat: -18.92, lon: -48.28 })).toBe('-18.9200, -48.2800')
  })

  it('número com casas decimais no jeito de cada idioma', () => {
    expect(formatDecimal('pt', -18.9543, 2)).toBe('-18,95')
    expect(formatDecimal('en', -48.1993, 2)).toBe('-48.20')
  })

  it('valor aproximado: centenas até 10 mil, depois milhares por extenso (PRD §7.11)', () => {
    expect(normalize(formatApproxMoney('pt', 3440))).toBe('3.400')
    expect(normalize(formatApproxMoney('pt', -1480))).toBe('1.500')
    expect(normalize(formatApproxMoney('pt', 25600))).toBe('26 mil')
    expect(normalize(formatApproxMoney('en', 25600))).toBe('26 thousand')
    expect(normalize(formatApproxMoney('en', 3440))).toBe('3,400')
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
