import type { FastifyInstance, RouteOptions } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'

// The hook test proves a route without `serviceAllowed` refuses a service; this
// pins down the list of routes that do carry it, so opening one more is a
// visible line in a diff instead of a side effect.
describe('the set of routes a service may call', () => {
  let app: FastifyInstance
  const registered: RouteOptions[] = []
  const serviceRoutes: string[] = []

  beforeAll(async () => {
    app = buildApp()

    app.addHook('onRoute', (route) => {
      registered.push(route)
    })

    await app.ready()

    for (const route of registered) {
      if (route.config?.serviceAllowed !== true) {
        continue
      }
      const methods = Array.isArray(route.method) ? route.method : [route.method]
      for (const method of methods) {
        serviceRoutes.push(`${method} ${route.url}`)
      }
    }
  })

  afterAll(async () => {
    await app.close()
  })

  it('is exactly what the enrollment-integrations needs to open and follow a ticket', () => {
    expect([...serviceRoutes].sort()).toEqual([
      'GET /api/tickets',
      'GET /api/tickets/:id',
      'GET /api/tickets/:id/comments',
      'HEAD /api/tickets',
      'HEAD /api/tickets/:id',
      'HEAD /api/tickets/:id/comments',
      'POST /api/tickets',
      'POST /api/tickets/:id/comments',
    ])
  })

  // The hook asks the auth-service for one policy, the ticket one, for every
  // service-allowed route. Opening a route of another domain — a queue, a group
  // — would ask for the wrong policy and pass or fail for the wrong reason, so
  // that mistake has to be red here before it reaches the hook.
  it('opens only ticket-domain routes, which is the policy the hook asks for', () => {
    const outsideTheTicketDomain = serviceRoutes.filter(
      (route) => !route.split(' ')[1].startsWith('/api/tickets'),
    )

    expect(outsideTheTicketDomain).toEqual([])
  })
})
