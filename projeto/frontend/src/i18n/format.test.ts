import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDayMonth, formatNumber } from './format'

const normalize = (text: string) => text.replace(/\s/g, ' ')

describe('format', () => {
  it('formata reais sem centavos nos dois idiomas', () => {
    expect(normalize(formatCurrency('pt', 700))).toBe('R$ 700')
    expect(normalize(formatCurrency('pt', 1250))).toBe('R$ 1.250')
    expect(normalize(formatCurrency('en', 1250))).toBe('R$1,250')
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
