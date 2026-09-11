import { Writable } from 'node:stream'
import pino from 'pino'
import { describe, expect, it } from 'vitest'
import { createLoggerOptions, redactUrl } from './logger.js'
import { kebabOf, snakeOf } from './redact.js'

function captureLogs() {
  const lines: string[] = []
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString())
      callback()
    },
  })
  return { stream, lines }
}

function lastEntry(lines: string[]) {
  return JSON.parse(lines.at(-1) ?? '{}')
}

describe('createLoggerOptions', () => {
  it('uses info level in production and debug elsewhere', () => {
    expect(createLoggerOptions({ nodeEnv: 'production' }).level).toBe('info')
    expect(createLoggerOptions({ nodeEnv: 'development' }).level).toBe('debug')
    expect(createLoggerOptions({ nodeEnv: 'test' }).level).toBe('debug')
  })

  it('only attaches the pino-pretty transport in development', () => {
    expect(createLoggerOptions({ nodeEnv: 'development' }).transport).toBeDefined()
    expect(createLoggerOptions({ nodeEnv: 'production' }).transport).toBeUndefined()
    expect(createLoggerOptions({ nodeEnv: 'test' }).transport).toBeUndefined()
  })

  it('redacts the Authorization header from request logs', () => {
    const { stream, lines } = captureLogs()
    const logger = pino(createLoggerOptions({ nodeEnv: 'test' }), stream)

    logger.info(
      {
        req: {
          method: 'GET',
          url: '/api/tickets',
          headers: {
            authorization: 'Bearer super-secret-token',
            'content-type': 'application/json',
          },
        },
      },
      'request received',
    )

    const entry = lastEntry(lines)
    expect(entry.req.headers.authorization).toBe('[REDACTED]')
    expect(entry.req.headers['content-type']).toBe('application/json')
  })

  // `sub` is the JWT subject, and in Pipo's tokens it holds the person's
  // e-mail — the same value as `email`, under a key redaction did not cover.
  it('redacts the jwt subject, which carries the e-mail under another name', () => {
    const { stream, lines } = captureLogs()
    const logger = pino(createLoggerOptions({ nodeEnv: 'test' }), stream)

    logger.warn({ sub: 'person@example.com', required: ['a/b/c/d/*'] }, 'request refused')

    const entry = lastEntry(lines)
    expect(entry.sub).toBe('[REDACTED]')
    expect(entry.required).toEqual(['a/b/c/d/*'])
  })

  it('redacts passwords, tokens, cpf, email, tax-id and address regardless of which object holds them', () => {
    const { stream, lines } = captureLogs()
    const logger = pino(createLoggerOptions({ nodeEnv: 'test' }), stream)

    logger.info(
      {
        user: {
          id: 'user-1',
          password: 'hunter2',
          token: 'abc123',
          cpf: '123.456.789-00',
          email: 'person@example.com',
          'tax-id': '12-3456789',
          address: 'Rua Exemplo, 123',
        },
      },
      'user updated',
    )

    const entry = lastEntry(lines)
    expect(entry.user.id).toBe('user-1')
    expect(entry.user.password).toBe('[REDACTED]')
    expect(entry.user.token).toBe('[REDACTED]')
    expect(entry.user.cpf).toBe('[REDACTED]')
    expect(entry.user.email).toBe('[REDACTED]')
    expect(entry.user['tax-id']).toBe('[REDACTED]')
    expect(entry.user.address).toBe('[REDACTED]')
  })

  it('redacts PII fields logged at the root of the log object', () => {
    const { stream, lines } = captureLogs()
    const logger = pino(createLoggerOptions({ nodeEnv: 'test' }), stream)

    logger.info(
      { ticketId: 'ticket-1', email: 'person@example.com', password: 'hunter2' },
      'ticket created',
    )

    const entry = lastEntry(lines)
    expect(entry.ticketId).toBe('ticket-1')
    expect(entry.email).toBe('[REDACTED]')
    expect(entry.password).toBe('[REDACTED]')
  })

  it('logs level as a string label instead of the raw pino number', () => {
    const { stream, lines } = captureLogs()
    const logger = pino(createLoggerOptions({ nodeEnv: 'test' }), stream)

    logger.info('ping')
    logger.error('pong')

    const [info, error] = lines.map((line) => JSON.parse(line))
    expect(info.level).toBe('info')
    expect(error.level).toBe('error')
  })

  it('omits pid but keeps hostname in the base bindings', () => {
    const { stream, lines } = captureLogs()
    const logger = pino(createLoggerOptions({ nodeEnv: 'test' }), stream)

    logger.info('ping')

    const entry = lastEntry(lines)
    expect(entry.pid).toBeUndefined()
    expect(entry.hostname).toBeDefined()
  })

  it('keeps unrelated fields untouched', () => {
    const { stream, lines } = captureLogs()
    const logger = pino(createLoggerOptions({ nodeEnv: 'test' }), stream)

    logger.info({ ticketId: 'ticket-1', status: 'open' }, 'ticket created')

    const entry = lastEntry(lines)
    expect(entry.ticketId).toBe('ticket-1')
    expect(entry.status).toBe('open')
    expect(entry.msg).toBe('ticket created')
  })

  it.each(['tax-id', 'taxId', 'tax_id', 'beneficiaryName'])(
    'redacts %s, whichever spelling the writer used',
    (field) => {
      const { stream, lines } = captureLogs()
      const logger = pino(createLoggerOptions({ nodeEnv: 'test' }), stream)

      logger.info({ row: { [field]: 'sentinel-value' } }, 'ticket row')

      expect(lastEntry(lines).row[field]).toBe('[REDACTED]')
    },
  )

  /** Neutral wrapper key on purpose: `req`, `res` and `err` have serializers
   *  that rewrite the object before redaction runs. */
  it.each([
    ['at the root', { taxId: 'sentinel' }],
    ['one nesting in', { row: { taxId: 'sentinel' } }],
    ['two nestings in', { ctx: { row: { taxId: 'sentinel' } } }],
  ])('redacts personal data %s', (_label, payload) => {
    const { stream, lines } = captureLogs()
    const logger = pino(createLoggerOptions({ nodeEnv: 'test' }), stream)

    logger.info(payload, 'ticket row')

    expect(lines.at(-1) ?? '').not.toContain('sentinel')
  })

  /** Where coverage ends — written down instead of discovered. */
  it.each([
    ['three nestings in', { ctx: { body: { row: { taxId: 'sentinel' } } } }],
    ['in an array two nestings in', { ctx: { body: [{ taxId: 'sentinel' }] } }],
  ])('does NOT reach personal data %s', (_label, payload) => {
    const { stream, lines } = captureLogs()
    const logger = pino(createLoggerOptions({ nodeEnv: 'test' }), stream)

    logger.info(payload, 'ticket row')

    expect(lines.at(-1) ?? '').toContain('sentinel')
  })

  it('redacts the enrollment snapshot as a whole, not field by field', () => {
    const { stream, lines } = captureLogs()
    const logger = pino(createLoggerOptions({ nodeEnv: 'test' }), stream)

    logger.info(
      { ticket: { enrollmentSnapshot: { primary: { profile: { name: 'Fulana' } } } } },
      'ticket created',
    )

    const line = lines.at(-1) ?? ''
    expect(lastEntry(lines).ticket.enrollmentSnapshot).toBe('[REDACTED]')
    expect(line).not.toContain('Fulana')
  })
})

describe('grafias', () => {
  it.each([
    ['accessToken', 'access-token', 'access_token'],
    ['taxId', 'tax-id', 'tax_id'],
    ['beneficiaryName', 'beneficiary-name', 'beneficiary_name'],
    ['apiKey', 'api-key', 'api_key'],
  ])('expands %s into kebab and snake case', (root, kebab, snake) => {
    expect(kebabOf(root)).toBe(kebab)
    expect(snakeOf(root)).toBe(snake)
  })

  /** A single-word root is its own kebab and snake form — the Set in `redact`
   *  relies on that to collapse the three into one path. */
  it('leaves a single-word root untouched', () => {
    expect(kebabOf('cpf')).toBe('cpf')
    expect(snakeOf('cpf')).toBe('cpf')
  })
})

describe('redactUrl', () => {
  it('redacts the search term, which is the name of whoever is being looked for', () => {
    const { stream, lines } = captureLogs()
    const logger = pino(createLoggerOptions({ nodeEnv: 'test' }), stream)

    logger.info(
      { req: { method: 'GET', url: '/api/tickets/rows?statuses=completed&subjectQuery=Maria' } },
      'request received',
    )

    const entry = lastEntry(lines)
    expect(entry.req.url).toContain('statuses=completed')
    expect(entry.req.url).not.toContain('Maria')
  })

  it('redacts the search of the older route too, which matches name and tax id', () => {
    expect(redactUrl('/api/tickets?search=Maria%20Silva')).not.toContain('Maria')
    expect(redactUrl('/api/tickets?search=12345678901')).not.toContain('12345678901')
  })

  it('writes the censor unescaped, so a redacted line stays greppable', () => {
    expect(redactUrl('/api/tickets/rows?subjectQuery=Maria')).toBe(
      '/api/tickets/rows?subjectQuery=[REDACTED]',
    )
  })

  /* `URLSearchParams.set` writes over the first occurrence in place, so the
     redacted line stays greppable by position for whoever is debugging. */
  it('keeps the parameters in the order they arrived', () => {
    expect(redactUrl('/api/tickets/rows?subjectQuery=Maria&tags=vip&window=all')).toBe(
      '/api/tickets/rows?subjectQuery=[REDACTED]&tags=vip&window=all',
    )
  })

  it('leaves a url with nothing to redact exactly as it came', () => {
    expect(redactUrl('/api/tickets/rows?tags=vip&window=all')).toBe(
      '/api/tickets/rows?tags=vip&window=all',
    )
    expect(redactUrl('/api/tickets/rows')).toBe('/api/tickets/rows')
  })
})
