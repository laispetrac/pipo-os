import type { FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { UnauthorizedError } from '../../shared/errors.js'
import { SESSION_COOKIE_NAME, extractSessionClaims, type SessionClaims } from './session.js'

export type Principal = SessionClaims

// Swagger-ui owns its routes, so they cannot carry our `public` config.
// Shared with the app.register call so the two cannot drift.
export const DOCS_ROUTE_PREFIX = '/docs'

declare module 'fastify' {
  interface FastifyRequest {
    // Unset only on public routes, which never read it.
    principal: Principal
  }

  interface FastifyContextConfig {
    public?: boolean
  }
}

// Swagger-ui serves the prefix itself and everything under it. A route that
// merely starts with the same characters is not the docs.
function isDocsRoute(url: string | undefined): boolean {
  return url === DOCS_ROUTE_PREFIX || url?.startsWith(`${DOCS_ROUTE_PREFIX}/`) === true
}

// The access-token may carry no `sub`, so a handler writing an author or an
// assignee has to demand it instead of assuming it.
export function requireUserId(request: FastifyRequest): string {
  const sub = request.principal.sub?.trim()

  if (!sub) {
    throw new UnauthorizedError('Invalid session')
  }

  return sub
}

export default fp(
  async function authenticatePlugin(app) {
    app.decorateRequest('principal')

    app.addHook('onRequest', async (request) => {
      // The 404 context inherits root hooks with an empty config: without this
      // an unknown route would answer 401 instead of 404.
      if (request.is404) {
        return
      }

      if (isDocsRoute(request.routeOptions.url)) {
        return
      }

      if (request.routeOptions.config.public === true) {
        return
      }

      const rawCookie = request.cookies[SESSION_COOKIE_NAME]
      const unsigned = rawCookie ? request.unsignCookie(rawCookie) : null
      const claims = unsigned?.valid && unsigned.value ? extractSessionClaims(unsigned.value) : null

      if (!claims) {
        throw new UnauthorizedError('Not authenticated')
      }

      request.principal = claims
    })
  },
  // Both run their own onRequest hook, and hooks fire in registration order:
  // before @fastify/cookie there is no request.cookies to read, and before
  // @fastify/cors a browser preflight would get 401 here instead of the 204
  // cors answers on its own — with every test still green, since inject()
  // sends no preflight.
  { name: 'authenticate', dependencies: ['@fastify/cookie', '@fastify/cors'] },
)
