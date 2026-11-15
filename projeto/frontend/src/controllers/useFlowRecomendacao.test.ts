import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Recomendacao } from '../models/recomendacao'
import type { FarmService } from '../services/farmService'
import { providers } from '../test/providers'
import { useFlowRecomendacao } from './useFlowRecomendacao'

function farm(): FarmService {
  return {
    talhao: vi.fn(),
    recomendacao: vi.fn(() => Promise.resolve({ opcoes: [] } as unknown as Recomendacao)),
  } as unknown as FarmService
}

describe('useFlowRecomendacao', () => {
  it('manda à API o confirmadas que sai das respostas das safras da tela 4 (pacote 2)', async () => {
    const f = farm()
    renderHook(() => useFlowRecomendacao(f), {
      wrapper: providers('/resposta?lat=-18.9543&lon=-48.1993&colheita=tarde&safras=2024:milho_braquiaria,2025:pousio,2026:sem_soja'),
    })

    await waitFor(() => expect(f.recomendacao).toHaveBeenCalled())
    expect(vi.mocked(f.recomendacao).mock.calls[0][0]).toMatchObject({ confirmadas: '2024:plantou,2025:parado' })
  })

  it('continua aceitando o confirmadas dos links antigos', async () => {
    const f = farm()
    renderHook(() => useFlowRecomendacao(f), {
      wrapper: providers('/resposta?lat=-18.9543&lon=-48.1993&colheita=tarde&confirmadas=2025:parado'),
    })

    await waitFor(() => expect(f.recomendacao).toHaveBeenCalled())
    expect(vi.mocked(f.recomendacao).mock.calls[0][0]).toMatchObject({ confirmadas: '2025:parado' })
  })
})
