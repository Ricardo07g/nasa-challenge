import { Fragment, type ReactNode } from 'react'
import styles from './Compare.module.css'

export type CropPickerItem = {
  value: string
  label: string
  selected: boolean
  /** Imagem da planta (`PlantImage`). */
  media?: ReactNode
  /** Selo embaixo do nome (ex.: "Sede da cultura"). */
  badge?: ReactNode
  /** Fora da janela de plantio: o botão fica desligado e o motivo vai escrito nele. */
  disabled?: boolean
  note?: string
}

/**
 * Chips das culturas com a imagem da planta e o selo (aba Comparar, tarefa 0045): um botão por cultura, a
 * escolha em `aria-pressed`. O desligado diz o motivo em texto (nada só por cor).
 */
export function CropPicker({ label, items, onToggle }: { label: string; items: readonly CropPickerItem[]; onToggle: (value: string) => void }) {
  return (
    <div role="group" aria-label={label} className={styles.picker}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={styles.cropChip}
          aria-pressed={item.selected}
          disabled={item.disabled}
          onClick={() => onToggle(item.value)}
        >
          {item.media && <span className={styles.cropMedia}>{item.media}</span>}
          <span className={styles.cropText}>
            <span className={styles.cropLabel}>{item.label}</span>
            {item.badge}
            {item.note && <span className={styles.cropNote}>{item.note}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}

export type CompareColumn = { key: string; title: string; media?: ReactNode; badge?: ReactNode }

export type CompareTableRow = { label: string; icon?: ReactNode; cells: readonly ReactNode[] }

/**
 * Culturas lado a lado (aba Comparar, tarefa 0045): uma coluna por cultura e as mesmas linhas para todas. O
 * rótulo de cada linha ocupa a largura inteira em cima das células, para caber 3 colunas no celular.
 */
export function CompareTable({ caption, columns, rows }: { caption: string; columns: readonly CompareColumn[]; rows: readonly CompareTableRow[] }) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={styles.head}>
                {column.media && <span className={styles.headMedia}>{column.media}</span>}
                <span className={styles.headTitle}>{column.title}</span>
                {column.badge}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <Fragment key={row.label}>
              <tr className={styles.labelRow}>
                <th scope="colgroup" colSpan={columns.length} className={styles.rowLabel}>
                  {row.icon && <span className={styles.rowIcon}>{row.icon}</span>}
                  {row.label}
                </th>
              </tr>
              <tr className={styles.cellRow}>
                {row.cells.map((cell, index) => (
                  <td key={columns[index]?.key ?? index} className={styles.cell}>
                    {cell}
                  </td>
                ))}
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
