import type { PolicyRequirement } from '../auth/policy.js'

/** The door to every route that reads or writes a ticket, wherever it lives —
 *  the queue module serves tickets too. A reader role would split this into
 *  `read` for the GETs; the V0 has analysts only. */
export const TICKET_POLICY: PolicyRequirement = { domain: 'ticket' }
