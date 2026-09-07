import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'

// Swagger-ui is only registered outside production and test, so reaching it at
// all means building the app under another NODE_ENV.
describe('the docs routes, with swagger-ui actually registered', () => {
  let app: FastifyInstance
  const originalNodeEnv = process.env.NODE_ENV

  beforeAll(async () => {
    process.env.NODE_ENV = 'development'
    app = buildApp()
    app.get('/docs-interna', async () => ({ ok: true }))
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    process.env.NODE_ENV = originalNodeEnv
  })

  it('serves the docs without a session cookie', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/' })

    expect(response.statusCode).toBe(200)
  })

  it('keeps a route that merely starts like the docs protected', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs-interna' })

    expect(response.statusCode).toBe(401)
  })
})
