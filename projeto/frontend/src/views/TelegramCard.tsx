import { Button } from '../design-system/components/Button'
import { Card } from '../design-system/components/Card'
import { ArrowUpRightIcon, SendIcon } from '../design-system/icons'
import type { Messages } from '../i18n/messages.pt'
import styles from './TelegramCard.module.css'

type TelegramCardProps = {
  t: Messages
  href: string
  /** Na safra passada, o convite é para ativar os avisos da próxima safra. */
  past?: boolean
}

/** Cartão "Receber no Telegram" (P5): só o link para o bot, que abre em outra aba. */
export function TelegramCard({ t, href, past = false }: TelegramCardProps) {
  const g = t.telegram
  return (
    <Card tone="blue" as="section" aria-label={g.title}>
      <div className={styles.layout}>
        <span className={styles.icon}>
          <SendIcon size={34} />
        </span>
        <div className={styles.body}>
          <h2 className={styles.title}>{g.title}</h2>
          <p>{past ? g.past : g.text}</p>
          <Button href={href} variant="blue" fullWidth={false} iconEnd={<ArrowUpRightIcon size={18} />}>
            {g.open}
          </Button>
        </div>
      </div>
    </Card>
  )
}
