/** A Pipo access policy, in the five parts the auth-service issues:
 *  `{context}/{effect}/{action}/{domain}/{specific}`. Only the domain has no
 *  sensible default. */
export interface PolicyRequirement {
  context?: string
  effect?: string
  action?: string
  domain: string
  specific?: string
}

export function policyString(requirement: PolicyRequirement): string {
  const {
    context = 'admin',
    effect = 'allow',
    action = 'administrate',
    domain,
    specific = '*',
  } = requirement

  return [context, effect, action, domain, specific].join('/')
}

// The wildcard only widens what the session holds: `*` in the session's policy
// covers any value the requirement names at that position, never the reverse.
export function policyMatches(held: string, required: string): boolean {
  const heldParts = held.split('/')
  const requiredParts = required.split('/')

  if (heldParts.length !== requiredParts.length) {
    return false
  }

  return heldParts.every((part, index) => part === '*' || part === requiredParts[index])
}

export function isAuthorized(policies: string[], required: PolicyRequirement[]): boolean {
  return required.some((requirement) => {
    const wanted = policyString(requirement)
    return policies.some((held) => policyMatches(held, wanted))
  })
}
