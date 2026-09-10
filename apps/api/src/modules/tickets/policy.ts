import type { PolicyRequirement } from '../auth/policy.js'

/** The door to every route that reads or writes a ticket, wherever it lives —
 *  the queue module serves tickets too. A reader role would split this into
 *  `read` for the GETs; the V0 has analysts only.
 *
 *  The domain is `pipodesk`, not `ticket`: `admin/allow/administrate/ticket/*`
 *  is already the admin role of the ticket-service (squad opex). The specific
 *  segment separates this from `pipodesk/structure`, the groups and queues. */
export const TICKET_POLICY: PolicyRequirement = { domain: 'pipodesk', specific: 'ticket' }
