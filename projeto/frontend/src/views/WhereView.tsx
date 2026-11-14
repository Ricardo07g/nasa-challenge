import { Button } from '../design-system/components/Button'
import { Card } from '../design-system/components/Card'
import { PageHeading } from '../design-system/components/Content'
import { MapPicker } from '../design-system/components/MapPicker'
import { BackLink, QuestionStepper } from '../design-system/components/Navigation'
import { CrosshairIcon } from '../design-system/icons'
import type { Messages } from '../i18n/messages.pt'
import type { Ponto } from '../models/talhao'
import layout from './layout.module.css'

export type WhereViewProps = {
  t: Messages
  center: Ponto
  place: string
  outside: boolean
  locating: boolean
  locationError: boolean
  onMove: (point: Ponto) => void
  onUseLocation: () => void
  onConfirm: () => void
}

/** Tela 2 "Onde fica a lavoura?" (pergunta 1 de 2). */
export function WhereView({
  t,
  center,
  place,
  outside,
  locating,
  locationError,
  onMove,
  onUseLocation,
  onConfirm,
}: WhereViewProps) {
  const w = t.where
  return (
    <div className={layout.page}>
      <BackLink to="/">{t.nav.back}</BackLink>
      <QuestionStepper current={1} total={2} label={t.stepper.label(1, 2)} />
      <PageHeading title={w.title} />
      <div className={layout.columns}>
        <div className={`${layout.column} ${layout.wide}`}>
          <MapPicker label={w.mapLabel} center={center} placeLabel={w.near(place)} onMove={onMove} />
        </div>
        <div className={`${layout.column} ${layout.narrow}`}>
          <Button variant="outline-blue" icon={<CrosshairIcon />} onClick={onUseLocation} disabled={locating}>
            {locating ? w.locating : w.useLocation}
          </Button>
          {locationError && <p role="alert">{w.locationError}</p>}
          <p className={layout.muted}>{w.help}</p>
          {outside && (
            <Card tone="orange" as="section" aria-label={w.outsideTitle}>
              <h2 className={layout.cardTitle}>{w.outsideTitle}</h2>
              <p>{w.outsideText}</p>
              <Button to="/exemplo" variant="outline">
                {w.seeExample}
              </Button>
            </Card>
          )}
          <Button onClick={onConfirm} disabled={outside}>
            {w.confirm}
          </Button>
        </div>
      </div>
    </div>
  )
}
