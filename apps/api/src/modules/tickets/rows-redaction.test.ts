import { Writable } from 'node:stream'
import { createLoggerOptions } from '@pipo-os/observability/logger'
import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { ticketRowSchema } from './rows-schema.js'

/** Fields whose value may not reach a log line. */
const REDACTED = new Set(['beneficiaryName', 'taxId'])

/** Everything else, listed one by one so a new field fails this test until
 *  someone classifies it. `assigneeId` and `title` are deliberate — see ACE-196. */
const KEPT = new Set([
  'id',
  'displayNumber',
  'title',
  'enrollmentId',
  'enrollmentType',
  'status',
  'priority',
  'actionDate',
  'groupId',
  'assigneeId',
  'companyId',
  'companyName',
  'carrierId',
  'carrierName',
  'product',
  'contractType',
  'companySize',
  'relationship',
  'tags',
  'sourceSystem',
  'closedAt',
  'createdAt',
  'updatedAt',
])

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
  const fields = Object.keys(ticketRowSchema.shape)

  it('classifies every field of the projection', () => {
    expect(new Set([...REDACTED, ...KEPT])).toEqual(new Set(fields))
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
