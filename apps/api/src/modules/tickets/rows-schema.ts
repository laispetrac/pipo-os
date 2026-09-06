import { z } from 'zod'
import { relationshipSchema, ticketPrioritySchema, ticketStatusSchema } from './schemas.js'

/** The `TicketFilter` as a query string: repeated parameters, which Fastify
 *  hands over as a bare value when a field occurs once. */
/** `@none` is the client's own token for `null`, which cannot travel here. */
const NULL_TOKEN = '@none'

/** One preprocess and no nesting — a preprocess inside another has no type the
 *  OpenAPI export can describe. */
const list = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((raw) => {
    if (raw === undefined) return undefined
    const values = Array.isArray(raw) ? raw : [raw]
    return values.map((value) => (value === NULL_TOKEN ? null : value))
  }, z.array(item).min(1))

const text = z.string().min(1)

export const ticketRowsQuerySchema = z.object({
  statuses: list(ticketStatusSchema).optional(),
  companyIds: list(z.uuid()).optional(),
  carrierIds: list(text).optional(),
  products: list(text).optional(),
  types: list(text).optional(),
  companySizes: list(text).optional(),
  contractTypes: list(text.nullable()).optional(),
  relationships: list(relationshipSchema).optional(),
  origins: list(text).optional(),
  groupIds: list(z.uuid()).optional(),
  tags: list(text).optional(),
  assigneeIds: list(text.nullable()).optional(),
  priorities: list(ticketPrioritySchema.nullable()).optional(),
  actionDateBefore: z.iso.date().optional(),
  urgentBy: z.iso.date().optional(),
  createdSince: z.iso.date().optional(),
  archived: z.stringbool().optional(),
  window: z.enum(['awake', 'sleeping', 'all']).default('awake'),
  limit: z.coerce.number().int().min(1).max(5000).default(5000),
})

/** No `enrollment_snapshot` — leaving it out is the point of the endpoint.
 *  The three fields dug out of it say word or null, never `''`, like the five
 *  movement columns: a blank is not a name. */
export const ticketRowSchema = z
  .object({
    id: z.uuid(),
    displayNumber: z.string(),
    title: z.string().nullable(),
    enrollmentId: z.uuid(),
    enrollmentType: z.string(),
    status: ticketStatusSchema,
    priority: ticketPrioritySchema.nullable(),
    actionDate: z.iso.datetime({ offset: true }).nullable(),
    groupId: z.uuid().nullable(),
    assigneeId: z.string().min(1).nullable(),
    companyId: z.uuid(),
    companyName: z.string().min(1).nullable(),
    beneficiaryName: z.string().min(1).nullable(),
    taxId: z.string().min(1).nullable(),
    carrierId: z.string().nullable(),
    carrierName: z.string().nullable(),
    product: z.string().nullable(),
    contractType: z.string().nullable(),
    companySize: z.string().nullable(),
    relationship: relationshipSchema.nullable(),
    tags: z.array(z.string()),
    sourceSystem: z.string(),
    closedAt: z.iso.datetime({ offset: true }).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .meta({ id: 'TicketRow' })

/** Every field above, classified: `true` never reaches a log line.
 *
 *  The record is what makes this exhaustive. A literal needs a value per key,
 *  so adding a field to the schema stops compiling until it is classified —
 *  here, in the same file, in the same edit. The same list living in a test
 *  could only fail later and elsewhere, where pasting the name into the kept
 *  side is the cheapest way out, and a guard that is easiest to satisfy by
 *  rubber-stamping is not much of a guard.
 *
 *  `title` and `assigneeId` are kept on purpose (ACE-196): the title has never
 *  carried a person's name, and the assignee is a Pipo user id, not the
 *  beneficiary. */
export const ROW_FIELD_PII = {
  id: false,
  displayNumber: false,
  title: false,
  enrollmentId: false,
  enrollmentType: false,
  status: false,
  priority: false,
  actionDate: false,
  groupId: false,
  assigneeId: false,
  companyId: false,
  companyName: false,
  beneficiaryName: true,
  taxId: true,
  carrierId: false,
  carrierName: false,
  product: false,
  contractType: false,
  companySize: false,
  relationship: false,
  tags: false,
  sourceSystem: false,
  closedAt: false,
  createdAt: false,
  updatedAt: false,
} satisfies Record<keyof z.infer<typeof ticketRowSchema>, boolean>

export const ticketRowsSchema = z
  .object({
    data: z.array(ticketRowSchema),
    /** How many matched, which is more than `data` when `limit` cut. */
    total: z.number().int(),
  })
  .meta({ id: 'TicketRows' })

export type TicketRowsQuery = z.infer<typeof ticketRowsQuerySchema>
export type TicketRowPayload = z.infer<typeof ticketRowSchema>
