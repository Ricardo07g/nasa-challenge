import { describe, expect, it } from 'vitest'

/** Código-fonte de produção (sem os testes), lido como texto. */
const sources = import.meta.glob<string>('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })

const isTest = (path: string) => /\.test\.tsx?$/.test(path) || path.startsWith('/src/test/')
const isMock = (path: string) => path.startsWith('/src/repositories/mocks/')
const MOCK_IMPORT = /from\s+['"][^'"]*\/mocks\/[^'"]*['"]/

describe('fronteira dos dados de exemplo', () => {
  it('só repositories/index.ts (que decide o modo) importa repositories/mocks/', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => !isTest(path) && !isMock(path) && path !== '/src/repositories/index.ts')
      .filter(([, code]) => MOCK_IMPORT.test(code))
      .map(([path]) => path)

    expect(Object.keys(sources).length).toBeGreaterThan(50)
    expect(offenders).toEqual([])
  })
})
