import { useRef, useState } from 'react'
import { DeskIcon } from '@/components/pipodesk/icons'
import type { PopoverAlign } from '@/components/pipodesk/primitives'
import { FILTER_FIELD_COPY, type LabelContext } from '@/lib/pipodesk/filter-copy'
import { valuesOf, type FilterField, type TicketFilter } from '@/lib/pipodesk/filter'
import type { TicketRow } from '@/lib/pipodesk/ticket-row'
import { FilterPopover } from './FilterPopover'
import styles from './Queue.module.css'

/**
 * The funnel a filtering column carries in its header. It opens the SAME panel
 * as the toolbar's `Filtros`, already on the column's field — a shortcut into
 * what exists, not a second filtering surface.
 */
export interface ColumnFilterProps {
  field: FilterField
  /** The side the panel grows toward — the table decides, by column position. */
  align: PopoverAlign
  base: TicketRow[]
  filter: TicketFilter
  viewerId: string
  ctx: LabelContext
  onApply: (field: FilterField, values: string[]) => void
  onRemove: (field: FilterField) => void
  dateWindowDays: number | null
  onSetDateWindow: (days: number | null) => void
}

export function ColumnFilter({ field, align, ...panel }: ColumnFilterProps) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const name = `Filtrar por ${FILTER_FIELD_COPY[field]}`

  return (
    <span className={styles.panelAnchor}>
      <button
        type="button"
        ref={trigger}
        className={styles.columnFunnel}
        aria-label={name}
        aria-expanded={open}
        title={name}
        /* The whole header cell is not the sort trigger here — the button is —
           but the funnel sits inside it, so a stray bubble must not sort. */
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        <DeskIcon name="funnel" size={12} />
        {valuesOf(panel.filter, field).length > 0 && (
          <span className={styles.funnelDot} data-active="true" aria-hidden="true" />
        )}
      </button>
      {/* Mounted only while open, like the toolbar panel: a closed one would
          keep the search box of the last visit. */}
      {open && (
        <FilterPopover
          open={open}
          anchor={trigger}
          onClose={() => setOpen(false)}
          lockedField={field}
          align={align}
          {...panel}
        />
      )}
    </span>
  )
}
