import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type SyntheticEvent,
} from 'react'
import { CloseIcon } from '../icons'
import styles from './Modal.module.css'

export type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Nome do X ("Fechar" / "Close"). */
  closeLabel: string
  /** `wide` = 640 px (créditos); o padrão tem até 560 px. */
  size?: 'default' | 'wide'
  children: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
}

function show(dialog: HTMLDialogElement) {
  if (dialog.open) return
  // `showModal` deixa o resto da página inerte; sem ele (navegador antigo, jsdom), vale o atributo.
  if (typeof dialog.showModal === 'function') dialog.showModal()
  else dialog.setAttribute('open', '')
}

function hide(dialog: HTMLDialogElement) {
  if (typeof dialog.close === 'function') dialog.close()
  else dialog.removeAttribute('open')
}

/**
 * Modal reutilizável (tarefa 0052): o padrão de todo "ver detalhes". `<dialog>` nativo, que fecha com o X,
 * com Esc e com clique fora; o foco entra no modal, fica preso nele enquanto está aberto e volta a quem o
 * abriu. No computador fica no centro (560 px, ou 640 px no `wide`); no celular, é uma folha de baixo para
 * cima, com a largura toda e até 88% da altura. Quem abre e fecha é o controller da tela (`open`/`onClose`).
 */
export function Modal({ open, onClose, title, subtitle, closeLabel, size = 'default', children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const pressedOutside = useRef(false)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    show(dialog)
    focusables(dialog)[0]?.focus()
    return () => {
      hide(dialog)
      if (opener?.isConnected) opener.focus()
    }
  }, [open])

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const items = focusables(event.currentTarget)
    if (items.length === 0) {
      event.preventDefault()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (event.shiftKey && (active === first || !event.currentTarget.contains(active))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (active === last || !event.currentTarget.contains(active))) {
      event.preventDefault()
      first.focus()
    }
  }

  // Esc no navegador dispara o "cancel" do <dialog>: quem fecha é o onClose, para o estado da tela mandar.
  function onCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault()
    onClose()
  }

  // Clique fora = no fundo escurecido, que é o próprio <dialog> (o conteúdo ocupa a caixa toda).
  function onPointerDown(event: PointerEvent<HTMLDialogElement>) {
    pressedOutside.current = event.target === event.currentTarget
  }

  function onClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget && pressedOutside.current) onClose()
    pressedOutside.current = false
  }

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      data-size={size}
      aria-labelledby={titleId}
      onKeyDown={onKeyDown}
      onCancel={onCancel}
      onPointerDown={onPointerDown}
      onClick={onClick}
    >
      {open && (
        <div className={styles.box}>
          <div className={styles.top}>
            <div>
              <h2 id={titleId} className={styles.title}>
                {title}
              </h2>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
            <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
              <CloseIcon size={18} />
            </button>
          </div>
          <div className={styles.body}>{children}</div>
        </div>
      )}
    </dialog>
  )
}
