import type { FastifyInstance, RouteOptions } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'

// The hook test proves a route without `public` is protected; this pins down the
// list of routes that do carry it.
describe('the set of public routes', () => {
  let app: FastifyInstance
  const registered: RouteOptions[] = []
  const publicRoutes: string[] = []
  const devLoginEnabled = process.env.DEV_LOGIN_ENABLED

  beforeAll(async () => {
    // The dev-login route also declares public, but it only exists when the env
    // var turns it on — this list is the one a deployed environment gets.
    delete process.env.DEV_LOGIN_ENABLED
    app = buildApp()

    // /health is added by buildApp directly, ahead of this hook, and has a test
    // of its own. Everything registered as a plugin — the whole autoload tree,
    // where a new route is born — boots at ready() and passes through here.
    app.addHook('onRoute', (route) => {
      registered.push(route)
    })

    await app.ready()

    // Read after ready(), not inside the hook: a route can be stamped public by
    // an onRoute of its own scope, which runs later than this one.
    for (const route of registered) {
      if (route.config?.public !== true) {
        continue
      }
      const methods = Array.isArray(route.method) ? route.method : [route.method]
      for (const method of methods) {
        publicRoutes.push(`${method} ${route.url}`)
      }
    }
  })

  afterAll(async () => {
    await app.close()
    // Assigning undefined back would write the string 'undefined'.
    if (devLoginEnabled === undefined) {
      delete process.env.DEV_LOGIN_ENABLED
    } else {
      process.env.DEV_LOGIN_ENABLED = devLoginEnabled
    }
  })

  it('is exactly the routes that must answer before a session exists', () => {
    expect([...publicRoutes].sort()).toEqual([
      'GET /api/auth/google',
      'GET /api/auth/google/callback',
      'HEAD /api/auth/google',
      'HEAD /api/auth/google/callback',
      'POST /api/auth/logout',
    ])
  })
})
