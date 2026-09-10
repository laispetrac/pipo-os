import { decodeJwtPayload } from './session.js'

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

/** Refused locally so a forged token does not cost a round trip. Does not
 *  replace verify-token — only the auth-service reads the signature. */
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
