/**
 * Identificador do aparelho para os relatos da comunidade (tarefa 0047): aleatório, sem cadastro e sem
 * dado pessoal, guardado no `localStorage`. Serve só para limitar a quantidade de relatos e para
 * apagar os próprios. O backend guarda apenas o hash.
 *
 * O `localStorage` pode falhar (janela anônima, dados do site bloqueados): toda leitura e escrita fica
 * em try/catch, e aí o identificador e o "aviso visto" valem só para esta visita.
 */

export type DeviceRepository = {
  deviceId(): string
  /** O aviso "Seus vizinhos veem a região, não o seu ponto." já foi mostrado antes de um envio. */
  noticeSeen(): boolean
  markNoticeSeen(): void
}

const DEVICE_KEY = 'raiz-orbital.comunidade.aparelho'
const NOTICE_KEY = 'raiz-orbital.comunidade.aviso-visto'

/** UUID versão 4 com `crypto.getRandomValues` (funciona também fora de HTTPS, ao contrário do randomUUID). */
export function randomDeviceId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function browserStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

export function createLocalDeviceRepository(
  storage: () => Storage | null = browserStorage,
  newId: () => string = randomDeviceId,
): DeviceRepository {
  const memory = new Map<string, string>()

  function read(key: string): string | null {
    try {
      const value = storage()?.getItem(key)
      if (value) return value
    } catch {
      // Sem localStorage: fica o valor desta visita.
    }
    return memory.get(key) ?? null
  }

  function write(key: string, value: string) {
    memory.set(key, value)
    try {
      storage()?.setItem(key, value)
    } catch {
      // Sem localStorage: o valor vale só para esta visita.
    }
  }

  return {
    deviceId() {
      const saved = read(DEVICE_KEY)
      if (saved) return saved
      const id = newId()
      write(DEVICE_KEY, id)
      return id
    },
    noticeSeen: () => read(NOTICE_KEY) === 'sim',
    markNoticeSeen: () => write(NOTICE_KEY, 'sim'),
  }
}

export const deviceRepository = createLocalDeviceRepository()
