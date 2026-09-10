const SUBJECT_PREFIX = 'system:serviceaccount:'

interface KubernetesClaims {
  namespace?: unknown
  serviceaccount?: { name?: unknown }
}

/** A service account is only unique inside its namespace, and the EI has one in
 *  each: `enrollment-integrations` in `default`, `-worker` in `cronjobs`. */
export interface ServiceAccount {
  namespace: string
  name: string
}

export type TokenPayload = Record<string, unknown>

/** Reads the service account from the `kubernetes.io` claim, falling back to
 *  the `system:serviceaccount:ns:name` subject. Decoding without verifying is
 *  safe here because it decides nothing on its own: the token still has to
 *  survive the auth-service. */
export function serviceAccountOf(payload: TokenPayload | null): ServiceAccount | null {
  if (!payload) {
    return null
  }

  const kubernetes = payload['kubernetes.io'] as KubernetesClaims | undefined
  const name = kubernetes?.serviceaccount?.name
  const namespace = kubernetes?.namespace
  if (typeof name === 'string' && name && typeof namespace === 'string' && namespace) {
    return { namespace, name }
  }

  const subject = payload.sub
  if (typeof subject === 'string' && subject.startsWith(SUBJECT_PREFIX)) {
    const [claimedNamespace, claimedName] = subject.slice(SUBJECT_PREFIX.length).split(':')
    if (claimedNamespace && claimedName) {
      return { namespace: claimedNamespace, name: claimedName }
    }
  }

  return null
}

/** Refused locally so a forged token does not cost a round trip. Does not
 *  replace verify-token — only the auth-service reads the signature. */
export function tokenExpired(payload: TokenPayload | null): boolean {
  const exp = payload?.exp

  return typeof exp !== 'number' || exp * 1000 <= Date.now()
}

export function serviceAccountKey({ namespace, name }: ServiceAccount): string {
  return `${namespace}/${name}`
}

let parsedFrom: string | undefined
let parsedAccounts = new Set<string>()

/** Empty until someone lists the accounts, which is deliberate: one that nobody
 *  named cannot get in, even holding the policy. Parsed once per value and not
 *  per request — the variable is fixed at boot, but a test may rewrite it. */
export function allowedServiceAccounts(): ReadonlySet<string> {
  const configured = process.env.SERVICE_ALLOWED_ACCOUNTS ?? ''

  if (configured !== parsedFrom) {
    parsedFrom = configured
    parsedAccounts = new Set(
      configured
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
  }

  return parsedAccounts
}

export function bearerToken(header: string | undefined): string | null {
  if (!header) {
    return null
  }

  // RFC 7235 §2.1: the scheme name is case-insensitive.
  const match = /^Bearer +(.+)$/i.exec(header)
  return match ? match[1] : null
}
