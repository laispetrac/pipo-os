import type { PolicyRequirement } from '../auth/policy.js'

/** Pods, their members and the saved queues — one door for both modules, so
 *  the queues module imports this one. `pipodesk/*` covers it and the tickets. */
export const STRUCTURE_POLICY: PolicyRequirement = { domain: 'pipodesk', specific: 'structure' }
