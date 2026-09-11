import { ForbiddenError, ServiceUnavailableError, UnauthorizedError } from '../shared/errors.js'

// The auth-service has two listeners: the public one this API already uses for
// the Google login, and an internal one (port 4000) that owns /api/verify-token.
// Public routes go through the WAF, whose rule 942100 reads a policy string as
// SQL injection, so a policy check must use the internal listener.
export interface AuditHeaders {
  requestId?: string
  correlationId?: string
  userId?: string
  sourceIp?: string
}

export interface VerifyTokenParams {
  baseUrl: string
  token: string
  policies: string[]
  audit?: AuditHeaders
}

interface VerifyTokenResponse {
  'identity-id'?: unknown
}

// On the request path of every service call: an unbounded fetch would hold the
// request open for as long as the auth-service is hung.
const VERIFY_TIMEOUT_MS = 5_000

function auditHeaders(audit: AuditHeaders = {}): Record<string, string> {
  const headers: Record<string, string> = {}
  const wanted: Array<[string, string | undefined]> = [
    ['x-request-id', audit.requestId],
    ['x-correlation-id', audit.correlationId],
    ['x-user-id', audit.userId],
    ['x-forwarded-for', audit.sourceIp],
  ]

  for (const [name, value] of wanted) {
    if (value) {
      headers[name] = value
    }
  }

  return headers
}

/** Resolves the caller's identity, or throws the refusal the auth-service gave.
 *  A 403 there means one of unknown identity, malformed token or missing
 *  policy — it does not say which, and neither do we. */
export async function verifyToken({
  baseUrl,
  token,
  policies,
  audit,
}: VerifyTokenParams): Promise<string> {
  let response: Response

  try {
    response = await fetch(`${baseUrl}/api/verify-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auditHeaders(audit) },
      body: JSON.stringify({ token, policies }),
      // A 307/308 would replay this body, token included, at whatever Location
      // the answer named.
      redirect: 'error',
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })
  } catch (error) {
    // The upstream's own words travel as `cause`, which the error handler logs
    // and never publishes: a DomainError's message goes into the response body
    // as written, and this is the only one here the API did not write itself.
    throw new ServiceUnavailableError('auth-service verify-token is unreachable', { cause: error })
  }

  if (response.status === 401) {
    throw new UnauthorizedError('Invalid service credential')
  }

  if (response.status === 403) {
    throw new ForbiddenError('Service identity is not allowed here')
  }

  if (!response.ok) {
    throw new ServiceUnavailableError(`auth-service verify-token answered ${response.status}`)
  }

  const data = (await response.json().catch(() => ({}))) as VerifyTokenResponse
  const identityId = data['identity-id']

  // A 200 without an identity is the auth-service breaking its own contract:
  // treating it as authenticated would let a caller in with no identity at all.
  if (typeof identityId !== 'string' || !identityId) {
    throw new ServiceUnavailableError('auth-service verify-token answered without an identity')
  }

  return identityId
}
