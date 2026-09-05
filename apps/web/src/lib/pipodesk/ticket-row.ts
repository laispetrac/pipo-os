import type {
  Ticket,
  Relationship as ApiRelationship,
  TicketPriority as ApiPriority,
} from '@pipo-os/api-client'
import { businessDay } from '@/lib/date'
import type { ApiStatus, DisplayStatus, PendingReason } from './status'
import { toDisplayStatus } from './status'

/**
 * A flat queue row with everything table, filter, sort and grouping need.
 * The ONLY module that knows the `enrollmentSnapshot` shape (decision D4) —
 * isolating the read here keeps the rest pure, and a snapshot contract change
 * (RFC PD-001) costs one file, not the whole queue.
 */

export type Priority = ApiPriority
export type Relationship = ApiRelationship

/** The keys are the menu, in insertion order; `true` is filler. A record is
 *  the only shape TypeScript can demand be complete, because a literal needs a
 *  value per key — a `Priority[]` typechecks fine while missing a level, and
 *  `Priority` now comes from the contract. */
const PRIORITY_LEVELS: Record<Priority, true> = {
  urgent: true,
  high: true,
  medium: true,
  low: true,
}

/** In attack order, and provably complete by the record above. Shared so the
 *  detail menu and the filter guard cannot drift apart. */
export const PRIORITIES: readonly Priority[] = Object.keys(PRIORITY_LEVELS) as Priority[]

/** Filter values come from the URL, which is hand-editable: a string is only
 *  a `Priority` after this check. */
export const isPriority = (value: string): value is Priority =>
  PRIORITIES.some((priority) => priority === value)

export interface TicketRow {
  id: string
  /** Human-readable id (`M000123`) — the ID column and search key. */
  displayNumber: string | null
  enrollmentId: string
  companyId: string
  /** Status as the API stores it (8 values). Every write uses this one. */
  status: ApiStatus
  /** Status as the UI shows it (6 values) + separate reason. */
  display: DisplayStatus
  reason: PendingReason | null
  subject: string
  beneficiaryName: string | null
  taxId: string | null
  companyName: string | null
  /** The parent company, when this ticket's company is a branch; `null` when it
   *  already is the parent. DSP-36 made the parent the key the queue filters
   *  and groups by — a client with forty branches is one client, and forty
   *  groups group nothing. It travels on the row, not as a company table to
   *  join client-side: the queue is a flat projection that will come from
   *  `GET /tickets/rows`, so the grouping key has to be in the projection. */
  parentCompanyId: string | null
  parentCompanyName: string | null
  companySize: string | null
  carrierId: string | null
  carrierName: string | null
  product: string | null
  enrollmentType: string
  contractType: string | null
  relationship: Relationship | null
  assigneeId: string | null
  groupId: string | null
  priority: Priority | null
  /** Date-only (`YYYY-MM-DD`). Every consumer compares strings against
   *  date-only cuts; `toTicketRow` reads whatever instant the API sends as its
   *  São Paulo day, so a deadline at 01:30Z belongs to the day before. */
  actionDate: string | null
  tags: string[]
  sourceSystem: string
  createdAt: string
  updatedAt: string
  closedAt: string | null
}

/** The company the queue answers "whose is this?" with: the parent when the
 *  ticket's company is a branch, the company itself otherwise (DSP-36). One
 *  derivation, three readers — the filter, the option counts and the grouping —
 *  because three copies of a rule is the known road to three different rules. */
export const principalIdOf = (row: TicketRow): string => row.parentCompanyId ?? row.companyId

export const principalNameOf = (row: TicketRow): string | null =>
  row.parentCompanyName ?? row.companyName

/** What the Empresa cell hovers. The branch does not enter the table — it
 *  complicates a line swept by the thousand — but it stays reachable here,
 *  next to the parent, without taking a column. The prototype writes the two
 *  legal names; the row only carries trade names, and adding two more columns
 *  to the projection for a tooltip is not worth it (registered on ACE-193). */
export const companyTitleOf = (row: TicketRow): string | undefined =>
  row.parentCompanyName
    ? `${row.parentCompanyName} › ${row.companyName ?? ''}`
    : (row.companyName ?? undefined)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** `member-type` (how EI serializes today) and `memberType` are the same key. */
const camelOf = (key: string): string =>
  key.replace(/[-_]([a-z])/g, (_, letter: string) => letter.toUpperCase())

const snakeOf = (key: string): string => key.replace(/[-]/g, '_')

/**
 * Reads a snapshot path accepting kebab/snake/camelCase per segment. The
 * contract is not frozen yet (RFC PD-001); a hyphen must not blank the queue.
 */
function readPath(source: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = source
  for (const segment of path) {
    if (!isRecord(current)) return undefined
    const record = current
    const key = [segment, camelOf(segment), snakeOf(segment)].find((candidate) =>
      Object.prototype.hasOwnProperty.call(record, candidate),
    )
    if (key === undefined) return undefined
    current = record[key]
  }
  return current
}

function readString(source: Record<string, unknown>, ...paths: string[][]): string | null {
  for (const path of paths) {
    const value = readPath(source, path)
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return null
}

/** Subject shaped like the Zendesk one: carrier · product · person. */
function buildSubject(ticket: Ticket, snapshot: Record<string, unknown>): string {
  const explicit =
    typeof ticket.title === 'string' && ticket.title.trim() !== '' ? ticket.title : null
  if (explicit) return explicit

  const parts = [
    ticket.carrierName,
    ticket.product,
    readString(snapshot, ['primary', 'profile', 'preferred-name'], ['primary', 'profile', 'name']),
  ].filter((part): part is string => part !== null)

  return parts.length > 0 ? parts.join(' · ') : ticket.id
}

export function toTicketRow(ticket: Ticket): TicketRow {
  const snapshot = isRecord(ticket.enrollmentSnapshot) ? ticket.enrollmentSnapshot : {}
  const { status: display, reason } = toDisplayStatus(ticket.status)

  return {
    id: ticket.id,
    displayNumber: ticket.displayNumber,
    enrollmentId: ticket.enrollmentId,
    companyId: ticket.companyId,
    status: ticket.status,
    display,
    reason,
    subject: buildSubject(ticket, snapshot),
    beneficiaryName: readString(
      snapshot,
      ['primary', 'profile', 'preferred-name'],
      ['primary', 'profile', 'name'],
    ),
    taxId: readString(snapshot, ['primary', 'profile', 'tax-id']),
    companyName: readString(snapshot, ['company', 'company-name'], ['company', 'name']),
    /* The API does not serve the parent company yet: the snapshot has the
       ticket's own company and nothing above it, and `GET /tickets/rows` has
       no column for it either (PD-043 has to add one). Until then the queue
       gets the parent only from the fixture, and a real API row groups by the
       branch — which is the old behaviour, not a silent wrong answer. */
    parentCompanyId: null,
    parentCompanyName: null,
    companySize: ticket.companySize,
    carrierId: ticket.carrierId,
    carrierName: ticket.carrierName,
    product: ticket.product,
    enrollmentType: ticket.enrollmentType,
    contractType: ticket.contractType,
    relationship: ticket.relationship,
    assigneeId: ticket.assigneeId,
    groupId: ticket.groupId,
    priority: ticket.priority,
    // The API sends an instant; every cut here compares São Paulo days.
    actionDate: ticket.actionDate === null ? null : businessDay(ticket.actionDate),
    tags: ticket.tags,
    sourceSystem: ticket.sourceSystem,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    closedAt: ticket.closedAt,
  }
}
