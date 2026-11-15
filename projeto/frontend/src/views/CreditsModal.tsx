import { Modal } from '../design-system/components/Modal'
import type { CreditsContent } from '../content/credits'
import { parseInline } from '../services/markdownService'
import styles from './CreditsModal.module.css'

/**
 * Uma linha dos créditos: o negrito (**…**) vira <strong> e o link de fora abre em nova aba (com o aviso
 * escondido para leitor de tela); o texto nunca vira HTML.
 */
function CreditLine({ text, newTab }: { text: string; newTab: string }) {
  return (
    <>
      {parseInline(text).map((part, index) => {
        if (part.type === 'strong') return <strong key={index}>{part.text}</strong>
        if (part.type === 'link' && part.external) {
          return (
            <a key={index} href={part.href} target="_blank" rel="noopener">
              {part.text}{' '}
              <span className="visually-hidden">{newTab}</span>
            </a>
          )
        }
        if (part.type === 'link') {
          return (
            <a key={index} href={part.href}>
              {part.text}
            </a>
          )
        }
        return <span key={index}>{part.text}</span>
      })}
    </>
  )
}

export type CreditsModalProps = {
  open: boolean
  onClose: () => void
  content: CreditsContent
  closeLabel: string
}

/**
 * Modal global "Créditos e uso de IA" (regra do NASA Space Apps, tarefa 0052): o rodapé de todas as telas
 * abre este mesmo modal (estado no `useShellController`). O conteúdo fica em `content/credits.ts` (as linhas das
 * fotos das plantas, com o link de cada arquivo no Commons, saem de `content/plantPhotos.ts`, tarefa 0055).
 */
export function CreditsModal({ open, onClose, content, closeLabel }: CreditsModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={content.title}
      subtitle={content.subtitle}
      closeLabel={closeLabel}
      size="wide"
    >
      {content.groups.map((group) => (
        <section key={group.id} className={styles.group} aria-label={group.title}>
          <h3 className={styles.heading}>{group.title}</h3>
          <ul className={styles.list}>
            {group.lines.map((line) => (
              <li key={line} className={styles.line}>
                <CreditLine text={line} newTab={content.newTab} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className={styles.group} aria-label={content.ai.title}>
        <h3 className={styles.heading}>{content.ai.title}</h3>
        <p className={styles.ai}>
          <CreditLine text={content.ai.text} newTab={content.newTab} />
        </p>
      </section>
    </Modal>
  )
}
