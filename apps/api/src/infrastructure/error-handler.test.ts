import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { buildApp } from '../app.js'
import { errorResponseSchema } from '../shared/schemas.js'
import { type ErrorDetails, NotFoundError, ValidationFailedError } from '../shared/errors.js'

const GATE_FAILURES: ErrorDetails = [
  { field: 'members.0.taxId', message: 'Required', code: 'invalid_type' },
  { field: 'members.0.idCardNumber', message: 'Required', code: 'invalid_type' },
  { field: 'startDate', message: 'Earlier than the admission date', code: 'out_of_range' },
]

describe('error handler', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = buildApp()
    const server = app.withTypeProvider<ZodTypeProvider>()

    // Public on purpose: these routes are about the error body, and a session
    // would only add a reason for them to fail.
    server.get(
      '/__test/gate-refusal',
      {
        config: { public: true },
        schema: { response: { 422: errorResponseSchema } },
      },
      async () => {
        throw new ValidationFailedError('Ticket cannot be completed', GATE_FAILURES)
      },
    )

    server.get(
      '/__test/missing',
      {
        config: { public: true },
        schema: { response: { 404: errorResponseSchema } },
      },
      async () => {
        throw new NotFoundError('Ticket not found')
      },
    )

    server.post(
      '/__test/movement',
      {
        config: { public: true },
        schema: {
          body: z
            .object({
              enrollmentId: z.uuid(),
              snapshot: z.object({ startDate: z.string() }),
            })
            .strict(),
          response: { 201: z.object({ ok: z.literal(true) }), 400: errorResponseSchema },
        },
      },
      async (_request, reply) => {
        reply.status(201)
        return { ok: true as const }
      },
    )

    server.get(
      '/__test/boom',
      {
        config: { public: true },
        schema: { response: { 500: errorResponseSchema } },
      },
      async () => {
        throw new Error('a connection pool detail nobody outside should read')
      },
    )

    server.get(
      '/__test/movement/:id',
      {
        config: { public: true },
        schema: {
          params: z.object({ id: z.uuid() }),
          response: { 200: z.object({ ok: z.literal(true) }), 400: errorResponseSchema },
        },
      },
      async () => ({ ok: true as const }),
    )

    // The handler returns what the response schema does not accept.
    server.get(
      '/__test/broken-contract',
      {
        config: { public: true },
        schema: { response: { 200: z.object({ id: z.uuid() }), 500: errorResponseSchema } },
      },
      async () => ({ id: 'not-a-uuid' }),
    )

    // A library error (an HTTP client, the driver) that happens to carry a 4xx.
    server.get(
      '/__test/library-4xx',
      {
        config: { public: true },
        schema: { response: { 500: errorResponseSchema } },
      },
      async () => {
        throw Object.assign(new Error('upstream said the internal id is unknown'), {
          statusCode: 404,
          code: 'ERR_UPSTREAM',
        })
      },
    )

    // Nobody throws a bare null on purpose; the point is that the handler must
    // not add a second failure on top of the first one.
    server.get(
      '/__test/throws-nothing',
      {
        config: { public: true },
        schema: { response: { 500: errorResponseSchema } },
      },
      async () => {
        throw null
      },
    )

    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  it('serializes the details of a refusal on a route that declares 422', async () => {
    const response = await app.inject({ method: 'GET', url: '/__test/gate-refusal' })

    expect(response.statusCode).toBe(422)
    expect(response.json()).toEqual({
      error: 'ValidationFailedError',
      message: 'Ticket cannot be completed',
      details: GATE_FAILURES,
    })
  })

  it('says which side of the request a field is on when it is not the body', async () => {
    const response = await app.inject({ method: 'GET', url: '/__test/movement/not-a-uuid' })

    expect(response.statusCode).toBe(400)
    expect(response.json().details).toEqual([
      { field: 'params.id', message: expect.any(String), code: 'invalid_format' },
    ])
  })

  it('still catches a response that does not match its own schema', async () => {
    const response = await app.inject({ method: 'GET', url: '/__test/broken-contract' })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: 'ResponseSerializationError',
      message: 'Response failed to match the schema',
    })
  })

  it('does not mirror a library 4xx outward, message and all', async () => {
    const response = await app.inject({ method: 'GET', url: '/__test/library-4xx' })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: 'InternalServerError',
      message: 'Something went wrong',
    })
  })

  it('leaves details out of the body when the error carries none', async () => {
    const response = await app.inject({ method: 'GET', url: '/__test/missing' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({ error: 'NotFoundError', message: 'Ticket not found' })
    expect(response.json()).not.toHaveProperty('details')
  })

  it('names every field a body got wrong, not just the first', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/__test/movement',
      payload: { enrollmentId: 'not-a-uuid' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toBe('RequestValidationError')
    expect(response.json().details).toEqual([
      { field: 'enrollmentId', message: expect.any(String), code: 'invalid_format' },
      { field: 'snapshot', message: expect.any(String), code: 'invalid_type' },
    ])
  })

  it('reads a nested path as a dotted field', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/__test/movement',
      payload: { enrollmentId: '6d1c1f4e-3a4b-4a8f-9c2d-5b7e8f0a1b2c', snapshot: { startDate: 1 } },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().details).toEqual([
      { field: 'snapshot.startDate', message: expect.any(String), code: 'invalid_type' },
    ])
  })

  it('falls back to the request part when the failure has no path of its own', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/__test/movement',
      payload: {
        enrollmentId: '6d1c1f4e-3a4b-4a8f-9c2d-5b7e8f0a1b2c',
        snapshot: { startDate: '2026-09-01' },
        unexpected: true,
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().details).toEqual([
      { field: 'body', message: expect.any(String), code: 'unrecognized_keys' },
    ])
  })

  it('answers 413, not 500, when the body is larger than the limit', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/__test/movement',
      payload: { enrollmentId: 'a'.repeat(2 * 1024 * 1024) },
    })

    expect(response.statusCode).toBe(413)
    expect(response.json().error).toBe('PayloadTooLargeError')
  })

  it('answers 415 for a content type no parser accepts', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/__test/movement',
      headers: { 'content-type': 'application/xml' },
      payload: '<movement />',
    })

    expect(response.statusCode).toBe(415)
    expect(response.json().error).toBe('UnsupportedMediaTypeError')
  })

  it('keeps an unexpected failure at the generic body, without its message', async () => {
    const response = await app.inject({ method: 'GET', url: '/__test/boom' })

    expect(response.statusCode).toBe(500)
    expect(response.json()).toEqual({
      error: 'InternalServerError',
      message: 'Something went wrong',
    })
  })

  it('survives a thrown value that is not an object', async () => {
    const response = await app.inject({ method: 'GET', url: '/__test/throws-nothing' })

    expect(response.statusCode).toBe(500)
    expect(response.json().error).toBe('InternalServerError')
  })
})
