import { Modal } from '../design-system/components/Modal'
import { NoticeIcon } from '../design-system/icons'
import type { Lang } from '../i18n/language'
import type { Messages } from '../i18n/messages.pt'
import { SeasonAnswersForm, type SeasonAnswersFormProps } from './SeasonAnswersForm'
import styles from './MissingSeasonsNotice.module.css'

export type MissingSeasonsNoticeProps = {
  t: Messages
  lang: Lang
  /** O texto do aviso; o padrão é "Você não preencheu as últimas safras." (a tela pode dizer o que faltou). */
  text?: string
  /** O modal "Preencher agora" está aberto (estado no controller da tela, como todo `Modal`). */
  open: boolean
  onOpen: () => void
  onClose: () => void
  /** O formulário do modal: as mesmas props do `SeasonAnswersForm` (as respostas mudam na hora, na URL). */
  form: Omit<SeasonAnswersFormProps, 't' | 'lang'>
}

/**
 * Resposta que faltou não trava (regra geral 6 do pacote 2): onde a tela usa as últimas safras (notas "como é
 * hoje", rotação, relatório) e elas não foram respondidas, aparece este aviso com o "Preencher agora", que
 * abre o modal com o `SeasonAnswersForm` para completar ali mesmo, sem sair da tela.
 */
export function MissingSeasonsNotice({ t, lang, text, open, onOpen, onClose, form }: MissingSeasonsNoticeProps) {
  const s = t.seasons
  return (
    <>
      <div className={styles.notice}>
        <NoticeIcon size={18} />
        <p>
          {text ?? s.missing}{' '}
          <button type="button" className={styles.fill} aria-haspopup="dialog" onClick={onOpen}>
            {s.fillNow}
          </button>
        </p>
      </div>
      <Modal open={open} onClose={onClose} title={s.modalTitle} subtitle={s.modalSubtitle} closeLabel={t.common.close} size="wide">
        <SeasonAnswersForm t={t} lang={lang} {...form} />
        <button type="button" className={styles.save} onClick={onClose}>
          {s.save}
        </button>
      </Modal>
    </>
  )
}
