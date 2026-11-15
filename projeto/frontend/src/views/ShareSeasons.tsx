import { Link } from 'react-router'
import { Button, TextButton } from '../design-system/components/Button'
import { CommunityIcon, SendIcon } from '../design-system/icons'
import type { SeasonShare } from '../controllers/useSatelliteController'
import type { Messages } from '../i18n/messages.pt'
import { CULTURAS_RELATO } from '../models/community'
import type { PlantingDraft } from '../services/communityService'
import { seasonName } from '../services/seasonService'
import { PlantingFields, PrivacyNotice, SendResult } from './CommunityForms'
import styles from './CommunityView.module.css'
import layout from './layout.module.css'

export type ShareSeasonsProps = {
  t: Messages
  state: SeasonShare
  communityTo: string
  onToggle: () => void
  onChange: (year: number, change: Partial<PlantingDraft>) => void
  onSend: (year: number) => void
}

/** Quem plantou escolhe a cultura entre as que plantam: "Deixei parado" já veio da confirmação. */
const PLANTED_CROPS = CULTURAS_RELATO.filter((crop) => crop !== 'pousio')

/**
 * "Compartilhar com a comunidade" no bloco "Confirme as últimas safras" (tela 4, tarefa 0047): grava o
 * relato de plantio de cada safra confirmada, no ponto da lavoura (o backend guarda só a célula).
 */
export function ShareSeasons({ t, state, communityTo, onToggle, onChange, onSend }: ShareSeasonsProps) {
  const c = t.community
  const anySent = state.rows.some((row) => row.status === 'sent')
  return (
    <div className={layout.stack}>
      <p className={layout.iconLine}>
        <CommunityIcon />
        <TextButton onClick={onToggle} expanded={state.open}>
          {c.shareTitle}
        </TextButton>
      </p>
      {state.open && (
        <div className={styles.form}>
          <p className={layout.muted}>{c.shareHint}</p>
          {state.showNotice && <PrivacyNotice t={t} />}
          {state.rows.map((row) => (
            <div key={row.year} role="group" aria-label={c.shareYear(seasonName(row.year))} className={layout.stack}>
              <strong>{c.shareYear(seasonName(row.year))}</strong>
              {row.idle ? (
                <p>{c.shareIdle}</p>
              ) : (
                <PlantingFields
                  t={t}
                  draft={row.draft}
                  years={[]}
                  crops={PLANTED_CROPS}
                  onChange={(change) => onChange(row.year, change)}
                />
              )}
              {row.status !== 'sent' && (
                <div className={layout.cta}>
                  <Button
                    variant="outline"
                    onClick={() => onSend(row.year)}
                    disabled={!row.ready || row.status === 'sending'}
                    icon={<SendIcon />}
                  >
                    {row.status === 'sending' ? c.sending : c.send}
                  </Button>
                </div>
              )}
              <SendResult t={t} result={row.status === 'sending' ? null : row.status} sentText={c.shareSent} />
            </div>
          ))}
          {anySent && <Link to={communityTo}>{c.shareSeeCommunity}</Link>}
        </div>
      )}
    </div>
  )
}
