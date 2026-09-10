import type { FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { verifyToken } from '../../infrastructure/auth-service-internal.js'
import { ForbiddenError, UnauthorizedError } from '../../shared/errors.js'
import { authServiceInternalUrl } from './config.js'
import { policyString, requiredPolicies } from './policy.js'
import { SESSION_COOKIE_NAME, extractSessionClaims, type SessionClaims } from './session.js'
import {
  allowedServiceNames,
  bearerToken,
  serviceNameFromToken,
  tokenExpired,
} from './service-principal.js'

export interface UserPrincipal extends SessionClaims {
  kind: 'user'
}

/** A caller that is not a person: another Pipo service, recognised by the
 *  service account token of its pod instead of a login. */
export interface ServicePrincipal {
  kind: 'service'
  name: string
  identityId: string
  policies: string[]
}

export type Principal = UserPrincipal | ServicePrincipal

declare module 'fastify' {
  interface FastifyRequest {
    // Optional on purpose: a public route has no principal, and the compiler is
    // what stops a handler there from reading one that is not going to be set.
    principal?: Principal
  }

  interface FastifyContextConfig {
    public?: boolean
    // Opt-in, one route at a time: a service reaching a route that never named
    // itself gets 403, so a route added later is closed to services by default.
    serviceAllowed?: boolean
  }
}

// Handlers reach the principal through this, never through request.principal,
// so a public route asking for one answers 401 instead of a TypeError.
export function requirePrincipal(request: FastifyRequest): Principal {
  const principal = request.principal

  if (!principal) {
    throw new UnauthorizedError('Not authenticated')
  }

  return principal
}

/** For a handler that only makes sense for a person: an author, an assignee,
 *  the `@me` of a queue. A service holding the policy still gets 403 here. */
export function requireUser(request: FastifyRequest): UserPrincipal {
  const principal = requirePrincipal(request)

  if (principal.kind !== 'user') {
    throw new ForbiddenError('This action belongs to a person, not to a service')
  }

  return principal
}

/** Who to record as the author of a write. A person is their `sub`; a service
 *  is `svc:<name>`, in the same text column, because blanking the author would
 *  lose who wrote it. */
export function requireActor(request: FastifyRequest): string {
  const principal = requirePrincipal(request)

  return principal.kind === 'service' ? `svc:${principal.name}` : requireUserId(request)
}

// The access-token may carry no `sub`, so a handler writing an author or an
// assignee has to demand it instead of assuming it.
export function requireUserId(request: FastifyRequest): string {
  const sub = requireUser(request).sub?.trim()

  if (!sub) {
    throw new UnauthorizedError('Invalid session')
  }

  return sub
}

function auditOf(request: FastifyRequest, serviceName: string) {
  const header = (name: string): string | undefined => {
    const value = request.headers[name]
    return typeof value === 'string' ? value : undefined
  }

  return {
    requestId: request.id,
    correlationId: header('x-correlation-id'),
    userId: `svc:${serviceName}`,
    sourceIp: header('x-forwarded-for') ?? request.ip,
  }
}

async function servicePrincipal(
  request: FastifyRequest,
  token: string,
  policies: string[],
): Promise<ServicePrincipal> {
  const name = serviceNameFromToken(token)

  if (!name) {
    throw new UnauthorizedError('Not a service account token')
  }

  if (tokenExpired(token)) {
    throw new UnauthorizedError('Service account token is expired')
  }

  if (!allowedServiceNames().has(name)) {
    request.log.warn({ service: name }, 'request refused: service is not in the allowlist')
    throw new ForbiddenError(`Service ${name} is not allowed`)
  }

  const identityId = await verifyToken({
    baseUrl: authServiceInternalUrl(),
    token,
    policies,
    audit: auditOf(request, name),
  })

  return { kind: 'service', name, identityId, policies }
}

export default fp(
  async function authenticatePlugin(app) {
    app.decorateRequest('principal')

    // A service is only ever let in against the policy its route names, so a
    // route that opens to services without naming one would send an empty
    // requirement to verify-token and get an identity check with no
    // authorisation behind it.
    app.addHook('onRoute', (route) => {
      if (route.config?.serviceAllowed === true && route.config.policy === undefined) {
        throw new Error(
          `Route ${route.method} ${route.url} accepts a service but declares no policy`,
        )
      }
    })

    app.addHook('onRequest', async (request) => {
      // The 404 context inherits root hooks with an empty config: without this
      // an unknown route would answer 401 instead of 404.
      if (request.is404) {
        return
      }

      if (request.routeOptions.config.public === true) {
        return
      }

      const rawCookie = request.cookies[SESSION_COOKIE_NAME]
      const unsigned = rawCookie ? request.unsignCookie(rawCookie) : null
      const claims = unsigned?.valid && unsigned.value ? extractSessionClaims(unsigned.value) : null

      if (claims) {
        request.principal = { kind: 'user', ...claims }
        return
      }

      const token = bearerToken(request.headers.authorization)

      if (!token) {
        throw new UnauthorizedError('Not authenticated')
      }

      // Read before the token is decoded, and before any call upstream: a route
      // that does not accept services closes here, and a broken auth-service
      // cannot turn that refusal into a 503.
      const declared = request.routeOptions.config.policy
      if (request.routeOptions.config.serviceAllowed !== true || declared === undefined) {
        throw new ForbiddenError('This route does not accept a service caller')
      }

      request.principal = await servicePrincipal(
        request,
        token,
        requiredPolicies(declared).map(policyString),
      )
    })
  },
  // Both run their own onRequest hook, and hooks fire in registration order:
  // before @fastify/cookie there is no request.cookies to read, and before
  // @fastify/cors a browser preflight would get 401 here instead of the 204
  // cors answers on its own — with every test still green, since inject()
  // sends no preflight.
  { name: 'authenticate', dependencies: ['@fastify/cookie', '@fastify/cors'] },
)
