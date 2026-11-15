import { describe, expect, it, vi } from 'vitest'
import { createLocalDeviceRepository, randomDeviceId } from './deviceRepository'

/** Armazenamento em memória com a mesma interface do localStorage. */
function memoryStorage(): Storage {
  const data = new Map<string, string>()
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

/** localStorage bloqueado (janela anônima, dados do site bloqueados): toda leitura e escrita falha. */
function blockedStorage(): Storage {
  const fail = () => {
    throw new DOMException('bloqueado', 'SecurityError')
  }
  return { length: 0, clear: fail, getItem: fail, key: fail, removeItem: fail, setItem: fail }
}

describe('deviceRepository (identificador do aparelho, sem cadastro, tarefa 0047)', () => {
  it('cria um identificador aleatório na primeira vez e guarda no aparelho', () => {
    const storage = memoryStorage()
    const newId = vi.fn(() => 'id-novo-1234')

    const first = createLocalDeviceRepository(() => storage, newId)
    const again = createLocalDeviceRepository(() => storage, newId)

    expect(first.deviceId()).toBe('id-novo-1234')
    expect(again.deviceId()).toBe('id-novo-1234')
    expect(newId).toHaveBeenCalledTimes(1)
  })

  it('sem localStorage, usa um identificador só desta visita e não quebra', () => {
    const repository = createLocalDeviceRepository(blockedStorage, () => 'id-da-visita')

    expect(repository.deviceId()).toBe('id-da-visita')
    expect(repository.deviceId()).toBe('id-da-visita')
    expect(repository.noticeSeen()).toBe(false)
    repository.markNoticeSeen()
    expect(repository.noticeSeen()).toBe(true)
  })

  it('lembra que o aviso de privacidade já foi visto', () => {
    const storage = memoryStorage()

    createLocalDeviceRepository(() => storage).markNoticeSeen()

    expect(createLocalDeviceRepository(() => storage).noticeSeen()).toBe(true)
  })

  it('o identificador aleatório tem o formato de um UUID versão 4', () => {
    const ids = new Set(Array.from({ length: 20 }, () => randomDeviceId()))

    expect(ids.size).toBe(20)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})
