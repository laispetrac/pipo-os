import fp from 'fastify-plugin'
import { ForbiddenError } from '../../shared/errors.js'
import { isAuthorized, policyString, type PolicyRequirement } from './policy.js'

declare module 'fastify' {
  interface FastifyContextConfig {
    // An array means any one of them is enough, like the :pipo-authenticated
    // vector the Clojure services declare.
    policy?: PolicyRequirement | PolicyRequirement[]
  }
}

function required(config: PolicyRequirement | PolicyRequirement[]): PolicyRequirement[] {
  return Array.isArray(config) ? config : [config]
}

export default fp(
  async function authorizePlugin(app) {
    // A route cannot be both open to anyone and behind a policy; without this
    // the public flag would win silently, since the hook below never runs. Like
    // any onRoute hook it only sees routes registered after it, which is every
    // module route — the autoload comes later in buildApp.
    app.addHook('onRoute', (route) => {
      if (route.config?.public === true && route.config.policy !== undefined) {
        throw new Error(
          `Route ${route.method} ${route.url} declares both public and a policy: pick one`,
        )
      }
    })

    app.addHook('onRequest', async (request) => {
      if (request.is404 || request.routeOptions.config.public === true) {
        return
      }

      const declared = request.routeOptions.config.policy
      if (declared === undefined) {
        return
      }

      const wanted = required(declared)
      const policies = request.principal?.policies ?? []

      if (!isAuthorized(policies, wanted)) {
        request.log.warn(
          { email: request.principal?.email, required: wanted.map(policyString) },
          'request refused: session lacks the policy the route requires',
        )
        throw new ForbiddenError(`Missing policy ${wanted.map(policyString).join(' or ')}`)
      }
    })
  },
  // After authenticate, so request.principal is already there and an anonymous
  // caller gets 401 from it instead of 403 from here.
  { name: 'authorize', dependencies: ['authenticate'] },
)
