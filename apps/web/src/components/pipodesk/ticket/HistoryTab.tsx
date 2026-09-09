import { useMemo } from 'react'
import {
  Status,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@piposaude/design-system'
import { Link } from '@tanstack/react-router'
import { ENROLLMENT_TYPE_COPY, PRODUCT_COPY } from '@/constants/pipodesk/domain'
import { DISPLAY_STATUS_COPY } from '@/constants/pipodesk/status'
import copy from '@/constants/pages/pipodesk/ticket/history'
import { formatNumericDate } from '@/lib/pipodesk/format'
import { historyOf, type TicketRecords } from '@/lib/pipodesk/record'
import type { TicketRow } from '@/lib/pipodesk/ticket-row'
import { RecordEmpty } from './RecordSection'
import styles from './HistoryTab.module.css'

export interface HistoryTabProps {
  ticket: TicketRow
  /** The queue rows as patched in this session, so a status change shows here too. */
  rows: TicketRow[]
  records: TicketRecords
}

const movementOf = (row: TicketRow): string => {
  const type = ENROLLMENT_TYPE_COPY[row.enrollmentType] ?? row.enrollmentType
  const product = row.product ? (PRODUCT_COPY[row.product] ?? row.product) : null
  return product ? `${type} · ${product}` : type
}

/** Always the ticket's beneficiary, never the person shown in Dados pessoais. */
export function HistoryTab({ ticket, rows, records }: HistoryTabProps) {
  const history = useMemo(() => historyOf(rows, records, ticket.id), [rows, records, ticket.id])

  if (history.length === 0) return <RecordEmpty>{copy.empty}</RecordEmpty>

  return (
    <div className={styles.tab}>
      <Table className={styles.table}>
        <TableHead>
          <TableRow>
            <TableHeaderCell>{copy.columns.id}</TableHeaderCell>
            <TableHeaderCell>{copy.columns.movement}</TableHeaderCell>
            <TableHeaderCell>{copy.columns.carrier}</TableHeaderCell>
            <TableHeaderCell>{copy.columns.openedAt}</TableHeaderCell>
            <TableHeaderCell>{copy.columns.situation}</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {history.map((item) => {
            const current = item.id === ticket.id
            return (
              <TableRow key={item.id}>
                <TableCell>
                  {/* The current ticket is not a link to itself. */}
                  {current ? (
                    <span className={styles.current} aria-current="page">
                      {item.id}
                    </span>
                  ) : (
                    <Link to="/tickets/$id" params={{ id: item.id }}>
                      {item.id}
                    </Link>
                  )}
                </TableCell>
                <TableCell>{movementOf(item)}</TableCell>
                <TableCell>{item.carrierName ?? '—'}</TableCell>
                <TableCell>{formatNumericDate(item.createdAt)}</TableCell>
                <TableCell>
                  <Status variant="neutral">{DISPLAY_STATUS_COPY[item.display]}</Status>
                  {/* A second line, not a column: only the closed few have it. */}
                  {item.closedAt !== null && (
                    <span className={styles.closed}>
                      {copy.closedAt(formatNumericDate(item.closedAt))}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
