import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'
import { SESSION_COOKIE_NAME } from './session.js'

function cookieValue(
  response: { cookies: Array<{ name: string; value: string }> },
  name: string,
): string | null {
  return response.cookies.find((cookie) => cookie.name === name)?.value ?? null
}

const TICKET_POLICY_STRING = 'admin/allow/administrate/ticket/*'

async function session(app: FastifyInstance, policies: string[]): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/dev-login',
    payload: { policies },
  })
  return cookieValue(response, SESSION_COOKIE_NAME)!
}

describe('the policy hook', () => {
  let app: FastifyInstance
  let withPolicy: string
  let withoutPolicy: string
  let withAnotherDomain: string

  beforeAll(async () => {
    process.env.DEV_LOGIN_ENABLED = 'true'
    app = buildApp()

    // Added before ready(), the same way the auth hook is exercised: hooks bind
    // at preReady, so these routes are covered exactly like an autoloaded one.
    app.get('/__test/needs-ticket', { config: { policy: { domain: 'ticket' } } }, async () => ({
      ok: true,
    }))
    app.get('/__test/needs-nothing', async () => ({ ok: true }))
    app.get('/__test/open', { config: { public: true } }, async () => ({ ok: true }))

    await app.ready()

    withPolicy = await session(app, [TICKET_POLICY_STRING])
    withoutPolicy = await session(app, [])
    withAnotherDomain = await session(app, ['admin/allow/administrate/company/*'])
  })

  afterAll(async () => {
    await app.close()
    delete process.env.DEV_LOGIN_ENABLED
  })

  it('lets through the session that holds the policy', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/__test/needs-ticket',
      cookies: { [SESSION_COOKIE_NAME]: withPolicy },
    })

    expect(response.statusCode).toBe(200)
  })

  it('answers 403 when the session carries no policy', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/__test/needs-ticket',
      cookies: { [SESSION_COOKIE_NAME]: withoutPolicy },
    })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toEqual({
      error: 'ForbiddenError',
      message: `Missing policy ${TICKET_POLICY_STRING}`,
    })
  })

  it('answers 403 when the session only holds another domain', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/__test/needs-ticket',
      cookies: { [SESSION_COOKIE_NAME]: withAnotherDomain },
    })

    expect(response.statusCode).toBe(403)
  })

  // Identity comes first: telling an anonymous caller which policy it lacks
  // would answer a question it has not earned the right to ask.
  it('answers 401, not 403, when there is no session at all', async () => {
    const response = await app.inject({ method: 'GET', url: '/__test/needs-ticket' })

    expect(response.statusCode).toBe(401)
  })

  it('leaves a route that declares no policy to the session alone', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/__test/needs-nothing',
      cookies: { [SESSION_COOKIE_NAME]: withoutPolicy },
    })

    expect(response.statusCode).toBe(200)
  })

  it('leaves a public route alone', async () => {
    const response = await app.inject({ method: 'GET', url: '/__test/open' })

    expect(response.statusCode).toBe(200)
  })

  it('keeps an unknown route at 404 instead of turning it into 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/__test/nowhere',
      cookies: { [SESSION_COOKIE_NAME]: withoutPolicy },
    })

    expect(response.statusCode).toBe(404)
  })

  // Inside a plugin, which is where the module routes live: the onRoute hook
  // only sees what is registered after it, and it loads with the plugins.
  it('refuses to boot a route that declares both public and a policy', async () => {
    const contradictory = buildApp()
    contradictory.register(async (scope) => {
      scope.get(
        '/__test/contradictory',
        { config: { public: true, policy: { domain: 'ticket' } } },
        async () => ({ ok: true }),
      )
    })

    // Caught by hand, not with rejects: an app whose boot failed throws again
    // when the assertion helper inspects it.
    let caught: unknown
    try {
      await contradictory.ready()
    } catch (error) {
      caught = error
    }

    expect((caught as Error | undefined)?.message).toMatch(/declares both public and a policy/)
  })
})
