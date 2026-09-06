import { Writable } from 'node:stream'
import { createLoggerOptions } from '@pipo-os/observability/logger'
import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'
import { ROW_FIELD_PII } from './rows-schema.js'

/** Both sides come from the one classification in `rows-schema.ts`, so they
 *  cannot drift from the projection or from each other. The exhaustiveness
 *  that used to be asserted here is now the compiler's job: the record there
 *  fails to build when a field is added and left unclassified. */
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
  /** Guards the classification against being emptied: filtering a record whose
   *  values all flipped to `false` would leave `REDACTED` empty, and every
   *  assertion below would vacuously pass. */
  it('has personal data to redact in the first place', () => {
    expect(REDACTED).toEqual(['beneficiaryName', 'taxId'])
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
