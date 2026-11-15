import { useCallback, useEffect, useState } from 'react'
import type { ApiStatus } from '../models/apiStatus'
import type { CropOption } from '../models/cropOption'
import type { CurrentChoice, SeasonAnswer, SeasonAnswers } from '../models/seasonAnswers'
import { withSeasonAnswer } from '../services/seasonAnswersService'
import { apiMode as currentApiMode } from '../repositories'
import type { ApiMode } from '../repositories/repositoryMode'
import { cropOptionService, type CropOptionService } from '../services/cropOptionService'
import { healthService, type HealthService } from '../services/healthService'

type Deps = { apiMode: ApiMode; healthService: HealthService; cropOptionService: CropOptionService }

const defaultDeps: Deps = { apiMode: currentApiMode, healthService, cropOptionService }

/** Seção "Pacote 2": as peças compartilhadas funcionando (formulário das safras, aviso e modal grande). */
export type Package2Demo = {
  answers: SeasonAnswers
  onAnswer: (year: number, answer: SeasonAnswer | null) => void
  current: { choice: CurrentChoice | undefined; onChoose: (choice: CurrentChoice | null) => void; harvestDate: string; changeDateTo: string }
  modal: 'large' | 'seasons' | null
  openLarge: () => void
  openSeasons: () => void
  closeModal: () => void
}

/** /design-system, seção "Ambiente": de onde vêm os dados e se o backend real está de pé. */
export function useDesignSystemController(deps: Deps = defaultDeps) {
  const [backend, setBackend] = useState<ApiStatus>('carregando')
  const [cropOptions, setCropOptions] = useState<CropOption[]>([])
  const [cropOptionsError, setCropOptionsError] = useState(false)
  const { healthService: health, cropOptionService: crops } = deps

  useEffect(() => {
    let active = true
    health.getApiStatus().then((status) => active && setBackend(status))
    crops
      .listOptions()
      .then((options) => active && setCropOptions(options))
      .catch(() => active && setCropOptionsError(true))
    return () => {
      active = false
    }
  }, [health, crops])

  const [answers, setAnswers] = useState<SeasonAnswers>({})
  const [choice, setChoice] = useState<CurrentChoice | undefined>(undefined)
  const [modal, setModal] = useState<Package2Demo['modal']>(null)
  const pacote2: Package2Demo = {
    answers,
    onAnswer: useCallback((year: number, answer: SeasonAnswer | null) => setAnswers((now) => withSeasonAnswer(now, year, answer)), []),
    current: {
      choice,
      onChoose: useCallback((next: CurrentChoice | null) => setChoice(next ?? undefined), []),
      harvestDate: '2027-03-03',
      changeDateTo: '/design-system',
    },
    modal,
    openLarge: useCallback(() => setModal('large'), []),
    openSeasons: useCallback(() => setModal('seasons'), []),
    closeModal: useCallback(() => setModal(null), []),
  }

  return { apiMode: deps.apiMode, backend, cropOptions, cropOptionsError, pacote2 }
}
