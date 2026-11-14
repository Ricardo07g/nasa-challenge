import { describe, expect, it } from 'vitest'
import { detectLanguage, htmlLang } from './language'

describe('detectLanguage', () => {
  it('usa português quando o navegador está em português', () => {
    expect(detectLanguage(['pt-BR', 'en'], null)).toBe('pt')
  })

  it('usa inglês para qualquer outro idioma do navegador', () => {
    expect(detectLanguage(['en-US'], null)).toBe('en')
    expect(detectLanguage(['es-ES'], null)).toBe('en')
  })

  it('a escolha salva tem prioridade sobre o navegador', () => {
    expect(detectLanguage(['pt-BR'], 'en')).toBe('en')
  })

  it('ignora um valor salvo inválido', () => {
    expect(detectLanguage(['pt-BR'], 'fr')).toBe('pt')
  })
})

describe('htmlLang', () => {
  it('converte para o código do atributo lang', () => {
    expect(htmlLang('pt')).toBe('pt-BR')
    expect(htmlLang('en')).toBe('en')
  })
})
