import { describe, expect, it } from 'vitest'
import { createHttpCommunityRepository } from './communityRepository'
import { isNotConnected } from './httpClient'

describe('communityRepository (tela 8, comunidade)', () => {
  it('com a API real não há vizinhos simulados: a comunidade ainda não está conectada', async () => {
    const error = await createHttpCommunityRepository()
      .get('pt')
      .catch((e: unknown) => e)

    expect(isNotConnected(error)).toBe(true)
  })
})
