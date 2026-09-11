import { Writable } from 'node:stream'
import { createLoggerOptions } from '@pipo-os/observability/logger'
import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { PII_QUERY_PARAMS } from '@pipo-os/observability/redact'
import { QUERY_FIELD_PII, ROW_FIELD_PII } from './rows-schema.js'
import { createTicketBodySchema, updateTicketBodySchema } from './schemas.js'

/** Both sides derive from the classification in `rows-schema.ts`. */
const fields = Object.keys(ROW_FIELD_PII) as (keyof typeof ROW_FIELD_PII)[]
const REDACTED = fields.filter((field) => ROW_FIELD_PII[field] === true)
const KEPT = fields.filter((field) => ROW_FIELD_PII[field] !== true)

const SENTINEL = (field: string): string => `sentinel-${field}`

/** Through Fastify, which is the path production logs actually take. */
function captureLogs() {
  const lines: string[] = []
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString())
      callback()
    },
  })
  const app = Fastify({ logger: { ...createLoggerOptions({ nodeEnv: 'test' }), stream } })
  return { log: app.log, lines }
}

describe('ticket row logging', () => {
  /** An emptied classification would make every assertion below vacuous. */
  it('has personal data to redact in the first place', () => {
    expect(REDACTED.length).toBeGreaterThan(0)
  })

  it('redacts the personal data of a row logged whole', () => {
    const { log, lines } = captureLogs()
    const row = Object.fromEntries(fields.map((field) => [field, SENTINEL(field)]))

    log.info({ row }, 'ticket row')

    const line = lines.at(-1) ?? ''
    const entry: { row: Record<string, string> } = JSON.parse(line)

    for (const field of REDACTED) {
      expect(entry.row[field]).toBe('[REDACTED]')
      expect(line).not.toContain(SENTINEL(field))
    }
    for (const field of KEPT) {
      expect(entry.row[field]).toBe(SENTINEL(field))
    }
  })
})

/** `title` is classified as safe because nothing writes it. That is an
 *  invariant of the write schemas, so it is checked here. */
const validBody = {
  enrollmentId: '00000000-0000-4000-8000-000000000001',
  enrollmentType: 'inclusion',
  companyId: '00000000-0000-4000-8000-000000000002',
  sourceSystem: 'enrollment-integrations',
  enrollmentSnapshot: {},
}

describe('title', () => {
  it('is not writable, which is why it is not classified as personal data', () => {
    expect(Object.keys(createTicketBodySchema.shape)).not.toContain('title')

    const rejected = updateTicketBodySchema.safeParse({ title: 'Inclusão - MARIA SILVA' })

    expect(rejected.success).toBe(false)
  })
})

/** `tags` is classified as safe because a tag cannot hold a person. That is an
 *  invariant of the write schemas, so it is checked here. */
describe('tags', () => {
  it.each(['produto:health', 'porte:pme-plus', 'risco_carencia', 'pj_mov'])(
    'accepts the classification tag %s',
    (tag) => {
      const parsed = createTicketBodySchema.safeParse({ ...validBody, tags: [tag] })

      expect(parsed.success).toBe(true)
    },
  )

  it.each([
    ['a name', 'NATÁLIA MACHADO ANDRADE'],
    ['a name in a value', 'beneficiario:Maria Silva'],
    ['free text', 'ligar para a Maria amanhã'],
  ])('rejects %s as a tag', (_label, tag) => {
    const created = createTicketBodySchema.safeParse({ ...validBody, tags: [tag] })
    const updated = updateTicketBodySchema.safeParse({ tags: [tag] })

    expect(created.success).toBe(false)
    expect(updated.success).toBe(false)
  })
})

/** The query string is logged whole, so a parameter a person types has to be
 *  named in the redaction list as well as classified here. */
describe('the query string', () => {
  it('redacts every parameter classified as typed by a person', () => {
    const typed = Object.keys(QUERY_FIELD_PII).filter(
      (field) => QUERY_FIELD_PII[field as keyof typeof QUERY_FIELD_PII] === true,
    )

    expect(typed.length).toBeGreaterThan(0)
    // Contains, not equals: the list is the whole API's, this route is one of them.
    expect(PII_QUERY_PARAMS).toEqual(expect.arrayContaining(typed))
  })
})
