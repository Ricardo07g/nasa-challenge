import { describe, expect, it } from 'vitest'
import { createLocalSavedPointRepository } from './savedPointRepository'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

const KEY = 'raiz-orbital.avisos.ponto'

describe('savedPointRepository (ponto dos avisos salvo no aparelho, sem cadastro)', () => {
  it('sem nada salvo, não há ponto', () => {
    expect(createLocalSavedPointRepository(() => memoryStorage()).get()).toBeNull()
  })

  it('guarda o ponto, a colheita, o solo e as safras confirmadas no localStorage', () => {
    const storage = memoryStorage()
    const repo = createLocalSavedPointRepository(() => storage)

    repo.save({ lat: -18.9543, lon: -48.1993, colheita: 'meio', confirmadas: '2025:parado' })

    expect(JSON.parse(storage.getItem(KEY) ?? '')).toEqual({
      lat: -18.9543,
      lon: -48.1993,
      colheita: 'meio',
      confirmadas: '2025:parado',
    })
    expect(createLocalSavedPointRepository(() => storage).get()).toEqual({
      lat: -18.9543,
      lon: -48.1993,
      colheita: 'meio',
      confirmadas: '2025:parado',
    })
  })

  it('pacote 2: guarda junto a data da colheita, as respostas das safras e a escolha atual', () => {
    const storage = memoryStorage()
    const point = { lat: -18.9, lon: -48.2, data: '2027-02-18', safras: '2024:milho_braquiaria,2026:sem_soja', pensa: 'nao_sei' as const }

    createLocalSavedPointRepository(() => storage).save(point)

    expect(createLocalSavedPointRepository(() => storage).get()).toEqual(point)
  })

  it('pacote 2: data, safras ou escolha atual estragadas ficam de fora', () => {
    const repo = createLocalSavedPointRepository(() =>
      memoryStorage({ [KEY]: '{"lat":-18.9,"lon":-48.2,"data":"amanhã","safras":"2024:<b>","pensa":"<i>sorgo</i>"}' }),
    )

    expect(repo.get()).toEqual({ lat: -18.9, lon: -48.2 })
  })

  it('pacote 3: guarda junto a cultura do 1º ano do plano e o objetivo da tela 5', () => {
    const storage = memoryStorage()
    const point = { lat: -18.9, lon: -48.2, escolha: 'sorgo' as const, objetivo: 'renda' as const }

    createLocalSavedPointRepository(() => storage).save(point)

    expect(createLocalSavedPointRepository(() => storage).get()).toEqual(point)
  })

  it('pacote 3: plano estragado fica de fora, e a marca da lavoura de demonstração nunca volta', () => {
    const repo = createLocalSavedPointRepository(() =>
      memoryStorage({ [KEY]: '{"lat":-18.9,"lon":-48.2,"escolha":"soja_transgenica","objetivo":"lucro","exemplo":true}' }),
    )

    expect(repo.get()).toEqual({ lat: -18.9, lon: -48.2 })
  })

  it('ignora o que não é um ponto válido (outro formato ou valor estragado)', () => {
    const broken = createLocalSavedPointRepository(() => memoryStorage({ [KEY]: '{"lat":"x"}' }))
    const notJson = createLocalSavedPointRepository(() => memoryStorage({ [KEY]: 'não é json' }))
    const badBand = createLocalSavedPointRepository(() =>
      memoryStorage({ [KEY]: '{"lat":-18.9,"lon":-48.2,"colheita":"agosto","solo":"pedra"}' }),
    )

    expect(broken.get()).toBeNull()
    expect(notJson.get()).toBeNull()
    expect(badBand.get()).toEqual({ lat: -18.9, lon: -48.2 })
  })

  it('sem localStorage (janela anônima, site bloqueado), o ponto vale só para esta visita', () => {
    const throwing = () => {
      throw new Error('bloqueado')
    }
    const repo = createLocalSavedPointRepository(throwing)

    expect(repo.get()).toBeNull()
    repo.save({ lat: -18.9, lon: -48.2 })
    expect(repo.get()).toEqual({ lat: -18.9, lon: -48.2 })
  })
})
