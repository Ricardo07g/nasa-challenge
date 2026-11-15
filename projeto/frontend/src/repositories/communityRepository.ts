import type { Lang } from '../i18n/language'
import type { NovoRelato, RelatoComunidade, RelatosVizinhos } from '../models/community'
import type { Ponto } from '../models/talhao'
import {
  getJson as defaultGetJson,
  sendJson as defaultSendJson,
  type GetJson,
  type SendJson,
} from './httpClient'

export type CommunityRepository = {
  /** Os relatos das células a até 30 km do ponto; os deste aparelho vêm com `meu: true`. */
  list(point: Ponto, deviceId: string, lang: Lang): Promise<RelatosVizinhos>
  send(report: NovoRelato, deviceId: string): Promise<RelatoComunidade>
  remove(id: string, deviceId: string): Promise<void>
}

const PATH = '/api/comunidade/relatos'

/** O identificador aleatório do aparelho vai no cabeçalho `X-Aparelho` (o backend guarda só o hash). */
function deviceHeader(deviceId: string) {
  return { headers: { 'X-Aparelho': deviceId } }
}

/** Relatos da comunidade sem cadastro (tarefa 0047): listar, enviar e apagar o próprio. */
export function createHttpCommunityRepository(
  getJson: GetJson = defaultGetJson,
  sendJson: SendJson = defaultSendJson,
): CommunityRepository {
  return {
    list: (point, deviceId, lang) =>
      getJson<RelatosVizinhos>(`${PATH}?lat=${point.lat}&lon=${point.lon}`, { lang, ...deviceHeader(deviceId) }),
    send: async (report, deviceId) => {
      const sent = await sendJson<RelatoComunidade>('POST', PATH, report, deviceHeader(deviceId))
      if (!sent) throw new Error('POST sem corpo na resposta')
      return sent
    },
    remove: async (id, deviceId) => {
      await sendJson('DELETE', `${PATH}/${encodeURIComponent(id)}`, undefined, deviceHeader(deviceId))
    },
  }
}
