import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'
import { SESSION_COOKIE_NAME } from '../auth/session.js'
import { CLOSED_STATUSES, updateTicketBodySchema } from './schemas.js'

// DSP-19: a terminal status is terminal. The rule has to hold on every route
// that writes state, not only on the audited one.

const OPEN_STATUS = 'broker-open-issue'

const validTicketBody = {
  enrollmentId: '00000000-0000-4000-8000-000000000001',
  enrollmentType: 'inclusion',
  companyId: '00000000-0000-4000-8000-000000000002',
  sourceSystem: 'enrollment-integrations',
  enrollmentSnapshot: { name: 'Test User' },
}

describe('a closed ticket does not go back to an open state', () => {
  let app: FastifyInstance
  let sessionCookie: string

  beforeAll(async () => {
    process.env.DEV_LOGIN_ENABLED = 'true'
    app = buildApp()
    await app.ready()

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/dev-login',
      payload: { policies: ['admin/allow/administrate/ticket/*'] },
    })
    sessionCookie = login.cookies.find((c) => c.name === SESSION_COOKIE_NAME)!.value
  })

  afterAll(async () => {
    await app.close()
    delete process.env.DEV_LOGIN_ENABLED
  })

  afterEach(async () => {
    await app.db.deleteFrom('ticket_status_history').execute()
    await app.db.deleteFrom('tickets').execute()
  })

  /** A closed OPEN_STATUS would make every assertion below vacuous. */
  it('reopens to a status that is actually open', () => {
    expect(CLOSED_STATUSES.has(OPEN_STATUS)).toBe(false)
  })

  async function createClosedTicket(closingStatus: string): Promise<string> {
    const cookies = { [SESSION_COOKIE_NAME]: sessionCookie }
    const created = await app.inject({
      method: 'POST',
      url: '/api/tickets',
      payload: validTicketBody,
      cookies,
    })
    const { id } = created.json()

    const closed = await app.inject({
      method: 'PATCH',
      url: `/api/tickets/${id}/status`,
      payload: { status: closingStatus },
      cookies,
    })
    expect(closed.statusCode).toBe(200)

    return id
  }

  /** The audited door. Guarded since #35; asserted here so the rule reads as one. */
  it.each([...CLOSED_STATUSES])('refuses via PATCH /:id/status when %s', async (closingStatus) => {
    const cookies = { [SESSION_COOKIE_NAME]: sessionCookie }
    const id = await createClosedTicket(closingStatus)

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tickets/${id}/status`,
      payload: { status: OPEN_STATUS },
      cookies,
    })

    expect(response.statusCode).toBe(422)
  })

  /** The unaudited door: it wrote the column directly and left no history row. */
  it.each([...CLOSED_STATUSES])('refuses via PATCH /:id when %s', async (closingStatus) => {
    const cookies = { [SESSION_COOKIE_NAME]: sessionCookie }
    const id = await createClosedTicket(closingStatus)

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tickets/${id}`,
      payload: { status: OPEN_STATUS },
      cookies,
    })

    expect(response.statusCode).toBe(400)

    const after = await app.inject({ method: 'GET', url: `/api/tickets/${id}`, cookies })
    expect(after.json().status).toBe(closingStatus)
    expect(after.json().closedAt).not.toBeNull()
  })

  /** Clearing `closedAt` alone left a closed status with no closing date. */
  it('refuses to clear closedAt via PATCH /:id', async () => {
    const cookies = { [SESSION_COOKIE_NAME]: sessionCookie }
    const id = await createClosedTicket('completed')

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/tickets/${id}`,
      payload: { closedAt: null },
      cookies,
    })

    expect(response.statusCode).toBe(400)

    const after = await app.inject({ method: 'GET', url: `/api/tickets/${id}`, cookies })
    expect(after.json().closedAt).not.toBeNull()
  })

  /** Route-level refusals above come from the field being gone, not from a
   *  guard that a later edit could bypass. */
  it.each(['status', 'closedAt'])('has no %s in the update body schema', (field) => {
    expect(Object.keys(updateTicketBodySchema.shape)).not.toContain(field)
  })
})
