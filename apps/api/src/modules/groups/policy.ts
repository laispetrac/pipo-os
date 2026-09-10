import type { PolicyRequirement } from '../auth/policy.js'

/** The door to the structure around the tickets — pods, their members and the
 *  saved queues. Held apart from `pipodesk/ticket` because working a ticket is
 *  not the same as redrawing who owns which companies; `pipodesk/*` covers both.
 *
 *  It lives in the groups module and the queues module imports it: the two are
 *  one surface of administration, the way queues already imports TICKET_POLICY. */
export const STRUCTURE_POLICY: PolicyRequirement = { domain: 'pipodesk', specific: 'structure' }
