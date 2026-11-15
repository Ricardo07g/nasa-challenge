import { describe, expect, it } from 'vitest'
import { detectLanguage, htmlLang } from './language'

describe('detectLanguage', () => {
  it('sem escolha salva, o site abre em inglês: o idioma do navegador não conta (pedido de 15/11/2026)', () => {
    expect(detectLanguage(null)).toBe('en')
  })

  it('a escolha salva tem prioridade (quem trocou para PT continua em PT)', () => {
    expect(detectLanguage('pt')).toBe('pt')
    expect(detectLanguage('en')).toBe('en')
  })

  it('ignora um valor salvo inválido e fica no inglês', () => {
    expect(detectLanguage('fr')).toBe('en')
  })
})

describe('htmlLang', () => {
  it('converte para o código do atributo lang', () => {
    expect(htmlLang('pt')).toBe('pt-BR')
    expect(htmlLang('en')).toBe('en')
  })
})
