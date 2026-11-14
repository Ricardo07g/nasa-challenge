import { describe, expect, it } from 'vitest'
import { resolveApiMode } from './repositoryMode'

describe('resolveApiMode', () => {
  it('usa a API real por padrão: sem a variável, a tela nunca mostra dado de exemplo', () => {
    expect(resolveApiMode(undefined)).toBe('http')
    expect(resolveApiMode('')).toBe('http')
    expect(resolveApiMode('http')).toBe('http')
    expect(resolveApiMode('qualquer')).toBe('http')
  })

  it('usa os dados de exemplo só com VITE_API_MODE=mock explícito', () => {
    expect(resolveApiMode('mock')).toBe('mock')
  })
})
