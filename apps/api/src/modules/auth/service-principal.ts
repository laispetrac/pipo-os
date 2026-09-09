import { decodeJwtPayload } from './session.js'

/** The policy a service must hold to reach the ticket routes. A string here and
 *  not a builder because every service-allowed route is in the same family;
 *  when PD-022 lands, the requirement comes from the route's own `policy`.
 *
 *  `pipodesk`, not `ticket`: the `ticket` domain is already the admin role of
 *  the ticket-service (squad opex). The specific segment splits this from
 *  `pipodesk/structure`, the groups and queues of PD-025. */
export const SERVICE_PIPODESK_TICKET_POLICY = 'admin/allow/administrate/pipodesk/ticket'

const SUBJECT_PREFIX = 'system:serviceaccount:'

interface KubernetesClaims {
  serviceaccount?: { name?: unknown }
}

/** Reads the service account name the way the auth-service reads it, from the
 *  `kubernetes.io` claim, falling back to the `system:serviceaccount:ns:name`
 *  subject. Decoding without verifying is safe here because it decides nothing
 *  on its own: the token still has to survive the auth-service. */
export function serviceNameFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token)
  if (!payload) {
    return null
  }

  const kubernetes = payload['kubernetes.io'] as KubernetesClaims | undefined
  const claimed = kubernetes?.serviceaccount?.name
  if (typeof claimed === 'string' && claimed) {
    return claimed
  }

  const subject = payload.sub
  if (typeof subject === 'string' && subject.startsWith(SUBJECT_PREFIX)) {
    const name = subject.slice(SUBJECT_PREFIX.length).split(':')[1]
    return name || null
  }

  return null
}

/** The deadline the token carries. Same rule the session claims use, and the
 *  reason it is read here: a name in an unsigned payload costs nothing to
 *  forge, so refusing a stale or absent deadline locally keeps a forged token
 *  from spending a round trip to the auth-service. It does not replace that
 *  call — only the auth-service can say the signature is real. */
export function tokenExpired(token: string): boolean {
  const exp = decodeJwtPayload(token)?.exp

  return typeof exp !== 'number' || exp * 1000 <= Date.now()
}

/** Empty until someone lists the services, which is deliberate: a service that
 *  nobody named cannot get in, even holding the policy. */
export function allowedServiceNames(): Set<string> {
  const configured = (process.env.SERVICE_ALLOWED_NAMES ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)

  return new Set(configured)
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) {
    return null
  }

  const match = /^Bearer (.+)$/.exec(header)
  return match ? match[1] : null
}
