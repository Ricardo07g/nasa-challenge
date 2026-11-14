import { NotConnected, StripLegend, TappableYearStrip, YearStrip } from '../design-system/components/Status'
import type { Messages } from '../i18n/messages.pt'
import type { Opcao } from '../models/recomendacao'
import type { RainSummary } from '../services/satelliteService'
import { rainPeriodText } from './rainPeriod'

/**
 * Os anos de chuva de uma opção. Com os detalhes de cada ano (P1), dá para tocar e ver o que
 * aconteceu; sem eles (a API ainda não manda), fica a faixa estática com os anos bons de N.
 */
export function RainYears({ t, option }: { t: Messages; option: Opcao }) {
  const a = t.answer
  const label = a.rainStripLabel(option.chuva.anos_bons, option.chuva.anos)
  if (!option.anos_detalhe?.length) {
    return <YearStrip label={label} cells={option.chuva.faixa.map((good) => (good ? 'good' : 'bad'))} />
  }
  return (
    <TappableYearStrip
      label={label}
      years={option.anos_detalhe.map((detail) => ({
        year: detail.ano,
        state: detail.bom ? 'good' : 'bad',
        marker: detail.enso,
        text: detail.texto,
      }))}
      openLabel={a.yearOpen}
      stateLabel={(state) => (state === 'good' ? a.rainEnough : a.rainShort)}
      closeLabel={a.close}
    />
  )
}

/** Sem o detalhe de cada ano na API (P1): o que falta aparece como "Ainda não conectado". */
export function YearDetailNotConnected({ t }: { t: Messages }) {
  return <NotConnected label={t.common.notConnected} what={t.answer.yearDetail} />
}

/** Legenda dos quadrinhos de chuva; com os detalhes dos anos, mostra também El Niño e La Niña. */
export function RainLegend({ t, option, rain }: { t: Messages; option: Opcao; rain: RainSummary | null }) {
  const a = t.answer
  const detailed = Boolean(option.anos_detalhe?.length)
  return (
    <>
      <StripLegend
        items={[
          { state: 'good', label: a.rainEnough },
          { state: 'bad', label: a.rainShort },
        ]}
        markers={
          detailed
            ? [
                { kind: 'el_nino', label: a.ensoNino },
                { kind: 'la_nina', label: a.ensoNina },
              ]
            : []
        }
        note={rainPeriodText(t, option.chuva.anos, rain)}
      />
      {!detailed && <YearDetailNotConnected t={t} />}
    </>
  )
}
