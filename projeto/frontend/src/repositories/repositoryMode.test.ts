import { describe, expect, it } from 'vitest'
import { resolveApiMode } from './repositoryMode'

describe('resolveApiMode', () => {
  it('usa os dados de exemplo por padrão (o motor ainda não existe)', () => {
    expect(resolveApiMode(undefined)).toBe('mock')
    expect(resolveApiMode('')).toBe('mock')
    expect(resolveApiMode('qualquer')).toBe('mock')
  })

  it('usa a API real com VITE_API_MODE=http', () => {
    expect(resolveApiMode('http')).toBe('http')
  })
})
