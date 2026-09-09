import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyToken } from './auth-service-internal.js'

const BASE_URL = 'http://auth-service.platform:4000'
const TICKET_POLICY = 'admin/allow/administrate/ticket/*'
const SERVICE_TOKEN = 'header.payload.signature'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('verifyToken', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the identity the auth-service resolved from the token', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ 'identity-id': '3f1a6d6e-9c1e-4f0b-9d0e-2b7a1c5f8e42' }),
    )

    const identityId = await verifyToken({
      baseUrl: BASE_URL,
      token: SERVICE_TOKEN,
      policies: [TICKET_POLICY],
    })

    expect(identityId).toBe('3f1a6d6e-9c1e-4f0b-9d0e-2b7a1c5f8e42')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE_URL}/api/verify-token`)
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({
      token: SERVICE_TOKEN,
      policies: [TICKET_POLICY],
    })
  })

  it('refuses with 401 when the auth-service rejects the credential', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Invalid credentials' }, 401))

    await expect(
      verifyToken({ baseUrl: BASE_URL, token: SERVICE_TOKEN, policies: [TICKET_POLICY] }),
    ).rejects.toMatchObject({ name: 'UnauthorizedError', statusCode: 401 })
  })

  // The auth-service answers 403 for three different violations — unknown
  // identity, malformed token and missing policy — and none of them says which,
  // on purpose. All three are "you are not getting in" for the caller.
  it('refuses with 403 when the identity lacks the policy', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Unauthorized' }, 403))

    await expect(
      verifyToken({ baseUrl: BASE_URL, token: SERVICE_TOKEN, policies: [TICKET_POLICY] }),
    ).rejects.toMatchObject({ name: 'ForbiddenError', statusCode: 403 })
  })

  it('answers 503, not 500, when the auth-service is broken', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500))

    await expect(
      verifyToken({ baseUrl: BASE_URL, token: SERVICE_TOKEN, policies: [TICKET_POLICY] }),
    ).rejects.toMatchObject({ name: 'ServiceUnavailableError', statusCode: 503 })
  })

  it('answers 503 when the auth-service cannot be reached at all', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    await expect(
      verifyToken({ baseUrl: BASE_URL, token: SERVICE_TOKEN, policies: [TICKET_POLICY] }),
    ).rejects.toMatchObject({ name: 'ServiceUnavailableError', statusCode: 503 })
  })

  it('answers 503 when a 200 carries no identity', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}))

    await expect(
      verifyToken({ baseUrl: BASE_URL, token: SERVICE_TOKEN, policies: [TICKET_POLICY] }),
    ).rejects.toMatchObject({ name: 'ServiceUnavailableError', statusCode: 503 })
  })

  it('propagates the audit headers the other services propagate', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ 'identity-id': 'id-1' }))

    await verifyToken({
      baseUrl: BASE_URL,
      token: SERVICE_TOKEN,
      policies: [TICKET_POLICY],
      audit: { requestId: 'req-1', correlationId: 'corr-1', userId: 'svc', sourceIp: '10.0.0.1' },
    })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers).toMatchObject({
      'x-request-id': 'req-1',
      'x-correlation-id': 'corr-1',
      'x-user-id': 'svc',
      'x-forwarded-for': '10.0.0.1',
    })
  })

  it('leaves out the audit headers it has no value for', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ 'identity-id': 'id-1' }))

    await verifyToken({
      baseUrl: BASE_URL,
      token: SERVICE_TOKEN,
      policies: [TICKET_POLICY],
      audit: { requestId: 'req-1' },
    })

    const [, options] = fetchMock.mock.calls[0]
    expect(Object.keys(options.headers)).toEqual(['Content-Type', 'x-request-id'])
  })

  it('gives up on a hung auth-service instead of holding the request open', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ 'identity-id': 'id-1' }))

    await verifyToken({ baseUrl: BASE_URL, token: SERVICE_TOKEN, policies: [TICKET_POLICY] })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.signal).toBeInstanceOf(AbortSignal)
  })
})
