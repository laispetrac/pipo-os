import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '../../app.js'
import { requirePrincipal, requireUser } from './authenticate.js'

const TICKET = { domain: 'pipodesk', specific: 'ticket' }
const TICKET_POLICY = 'admin/allow/administrate/pipodesk/ticket'
const IDENTITY_ID = '3f1a6d6e-9c1e-4f0b-9d0e-2b7a1c5f8e42'
const SERVICE_NAME_IN_TEST = 'enrollment-integrations-worker'

function base64url(value: string): string {
  return Buffer.from(value).toString('base64url')
}

/** Shaped like the projected token Kubernetes mounts in every pod: the service
 *  account name lives under the `kubernetes.io` claim, and `sub` repeats it as
 *  `system:serviceaccount:<namespace>:<name>`. Nothing here is signed — the
 *  auth-service is what validates the token, and it is stubbed in these tests. */
function serviceAccountToken(name: string, expiresInSeconds = 3600): string {
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({
      iss: 'https://oidc.eks.sa-east-1.amazonaws.com/id/PIPO',
      sub: `system:serviceaccount:default:${name}`,
      exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
      'kubernetes.io': { namespace: 'default', serviceaccount: { name } },
    }),
  )
  return `${header}.${payload}.not-a-signature`
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('a service calling the API', () => {
  let app: FastifyInstance
  const fetchMock = vi.fn()
  const eiToken = serviceAccountToken('enrollment-integrations-worker')

  beforeAll(async () => {
    process.env.SERVICE_ALLOWED_NAMES = 'enrollment-integrations-worker'
    app = buildApp()

    // Added before ready() so the hooks bind to them exactly as they bind to an
    // autoloaded route.
    app.get(
      '/__test/open-to-service',
      { config: { serviceAllowed: true, policy: TICKET } },
      async (request) => ({ principal: requirePrincipal(request) }),
    )
    app.get('/__test/people-only', async () => ({ ok: true }))
    app.get(
      '/__test/reads-the-person',
      { config: { serviceAllowed: true, policy: TICKET } },
      async (request) => ({ email: requireUser(request).email }),
    )

    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    delete process.env.SERVICE_ALLOWED_NAMES
  })

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('gets in with the service account token of an allowed service', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ 'identity-id': IDENTITY_ID }))

    const response = await app.inject({
      method: 'GET',
      url: '/__test/open-to-service',
      headers: { authorization: `Bearer ${eiToken}` },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().principal).toEqual({
      kind: 'service',
      name: 'enrollment-integrations-worker',
      identityId: IDENTITY_ID,
      policies: [TICKET_POLICY],
    })
  })

  it('asks the auth-service for the ticket policy, not just for the identity', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ 'identity-id': IDENTITY_ID }))

    await app.inject({
      method: 'GET',
      url: '/__test/open-to-service',
      headers: { authorization: `Bearer ${eiToken}` },
    })

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('http://auth-service.platform:4000/api/verify-token')
    expect(JSON.parse(options.body).policies).toEqual([TICKET_POLICY])
  })

  // The route inventory is the fence, and it closes before the network: a route
  // that never opened itself to a service must not even be looked up upstream.
  it('is refused on a route that does not open itself to a service', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/__test/people-only',
      headers: { authorization: `Bearer ${eiToken}` },
    })

    expect(response.statusCode).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is refused when the service is not in the allowlist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/__test/open-to-service',
      headers: { authorization: `Bearer ${serviceAccountToken('some-other-service')}` },
    })

    expect(response.statusCode).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('is refused when the auth-service does not know the identity', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 403))

    const response = await app.inject({
      method: 'GET',
      url: '/__test/open-to-service',
      headers: { authorization: `Bearer ${eiToken}` },
    })

    expect(response.statusCode).toBe(403)
  })

  it('is refused when the auth-service rejects the token', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Invalid credentials' }, 401))

    const response = await app.inject({
      method: 'GET',
      url: '/__test/open-to-service',
      headers: { authorization: `Bearer ${eiToken}` },
    })

    expect(response.statusCode).toBe(401)
  })

  it('answers 503 when the auth-service is unreachable', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const response = await app.inject({
      method: 'GET',
      url: '/__test/open-to-service',
      headers: { authorization: `Bearer ${eiToken}` },
    })

    expect(response.statusCode).toBe(503)
  })

  it('answers 401 when a token carries no service account name', async () => {
    const userShapedToken = `${base64url(JSON.stringify({ alg: 'none' }))}.${base64url(
      JSON.stringify({ sub: 'pikachu@piposaude.com.br' }),
    )}.x`

    const response = await app.inject({
      method: 'GET',
      url: '/__test/open-to-service',
      headers: { authorization: `Bearer ${userShapedToken}` },
    })

    expect(response.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still answers 401 to a caller with neither cookie nor bearer', async () => {
    const response = await app.inject({ method: 'GET', url: '/__test/open-to-service' })

    expect(response.statusCode).toBe(401)
  })

  // A handler that needs a person — an author, an assignee, the @me of a queue
  // — must refuse a service instead of reading an e-mail that is not there.
  it('is refused by a handler that needs a person, even holding the policy', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ 'identity-id': IDENTITY_ID }))

    const response = await app.inject({
      method: 'GET',
      url: '/__test/reads-the-person',
      headers: { authorization: `Bearer ${eiToken}` },
    })

    expect(response.statusCode).toBe(403)
  })

  // Anyone can write a name into an unsigned payload, and the auth-service is
  // what catches that — but not before the API has already called it. Reading
  // the expiry first keeps a stale or empty deadline from costing a round trip.
  it('does not call the auth-service for a token that is already expired', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/__test/open-to-service',
      headers: { authorization: `Bearer ${serviceAccountToken(SERVICE_NAME_IN_TEST, -60)}` },
    })

    expect(response.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not call the auth-service for a token with no expiry at all', async () => {
    const noExpiry = `${base64url(JSON.stringify({ alg: 'RS256' }))}.${base64url(
      JSON.stringify({ 'kubernetes.io': { serviceaccount: { name: SERVICE_NAME_IN_TEST } } }),
    )}.x`

    const response = await app.inject({
      method: 'GET',
      url: '/__test/open-to-service',
      headers: { authorization: `Bearer ${noExpiry}` },
    })

    expect(response.statusCode).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  // Inside a plugin, which is where the module routes live: the onRoute hook
  // only sees what is registered after it, and it loads with the plugins.
  it('refuses to boot a route that accepts a service without naming a policy', async () => {
    const unguarded = buildApp()
    unguarded.register(async (scope) => {
      scope.get('/__test/no-policy', { config: { serviceAllowed: true } }, async () => ({
        ok: true,
      }))
    })

    // Caught by hand, not with rejects: an app whose boot failed throws again
    // when the assertion helper inspects it.
    let caught: unknown
    try {
      await unguarded.ready()
    } catch (error) {
      caught = error
    } finally {
      await unguarded.close().catch(() => {})
    }

    expect((caught as Error | undefined)?.message).toMatch(
      /accepts a service but declares no policy/,
    )
  })
})
