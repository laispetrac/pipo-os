import { describe, expect, it } from 'vitest'
import { isAuthorized, policyMatches, policyString } from './policy.js'

const TICKET = 'admin/allow/administrate/ticket/*'

describe('policyString', () => {
  it('fills the house defaults around the domain', () => {
    expect(policyString({ domain: 'ticket' })).toBe(TICKET)
  })

  it('keeps every part the declaration names', () => {
    expect(
      policyString({
        context: 'system',
        effect: 'allow',
        action: 'read',
        domain: 'ticket',
        specific: '6d1c1f4e',
      }),
    ).toBe('system/allow/read/ticket/6d1c1f4e')
  })
})

describe('policyMatches', () => {
  it('matches a policy the session holds verbatim', () => {
    expect(policyMatches(TICKET, TICKET)).toBe(true)
  })

  it('lets a wildcard the session holds cover a specific resource', () => {
    expect(policyMatches(TICKET, 'admin/allow/administrate/ticket/6d1c1f4e')).toBe(true)
  })

  // The wildcard only widens what the session holds. A requirement asking for
  // every ticket is not satisfied by permission over one of them.
  it('does not let a wildcard in the requirement accept a single resource', () => {
    expect(policyMatches('admin/allow/administrate/ticket/6d1c1f4e', TICKET)).toBe(false)
  })

  it('refuses a policy of another domain', () => {
    expect(policyMatches('admin/allow/administrate/company/*', TICKET)).toBe(false)
  })

  it('refuses a policy that only reads when the route asks to administrate', () => {
    expect(policyMatches('admin/allow/read/ticket/*', TICKET)).toBe(false)
  })

  it('refuses a policy of another context or effect', () => {
    expect(policyMatches('system/allow/administrate/ticket/*', TICKET)).toBe(false)
    expect(policyMatches('admin/deny/administrate/ticket/*', TICKET)).toBe(false)
  })

  // Real policies come in longer shapes, like admin/allow/read/email/hr/company/{uuid}.
  it('refuses a policy with a different number of parts', () => {
    expect(policyMatches('admin/allow/read/email/hr/company/abc', TICKET)).toBe(false)
    expect(policyMatches('admin/allow/administrate/ticket', TICKET)).toBe(false)
  })
})

describe('isAuthorized', () => {
  it('accepts a session that holds one of the required policies', () => {
    expect(isAuthorized([TICKET], [{ domain: 'queue' }, { domain: 'ticket' }])).toBe(true)
  })

  it('refuses a session with no policy at all', () => {
    expect(isAuthorized([], [{ domain: 'ticket' }])).toBe(false)
  })

  it('refuses a session holding only policies of other domains', () => {
    expect(
      isAuthorized(
        ['admin/allow/administrate/company/*', 'admin/allow/read/identity/*'],
        [{ domain: 'ticket' }],
      ),
    ).toBe(false)
  })
})
