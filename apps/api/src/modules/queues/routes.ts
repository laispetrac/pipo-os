import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireUserId } from '../auth/authenticate.js'
import { errorResponseSchema } from '../../shared/schemas.js'
import { STRUCTURE_POLICY } from '../groups/policy.js'
import { TICKET_POLICY } from '../tickets/policy.js'
import { ticketListSchema } from '../tickets/schemas.js'
import {
  addQueueGroupBodySchema,
  createQueueBodySchema,
  listQueueTicketsQuerySchema,
  listQueuesQuerySchema,
  queueGroupParamsSchema,
  queueGroupSchema,
  queueListSchema,
  queueParamsSchema,
  queueSchema,
  updateQueueBodySchema,
} from './schemas.js'
import type { QueuesService } from './service.js'

export function registerQueueRoutes(app: FastifyInstance, service: QueuesService): void {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.post(
    '/api/queues',
    {
      config: { policy: STRUCTURE_POLICY },
      schema: {
        body: createQueueBodySchema,
        response: {
          201: queueSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          413: errorResponseSchema,
          415: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const createdBy = requireUserId(request)
      const queue = await service.create(request.body, createdBy)
      reply.status(201)
      return queue
    },
  )

  server.get(
    '/api/queues',
    {
      config: { policy: STRUCTURE_POLICY },
      schema: {
        querystring: listQueuesQuerySchema,
        response: {
          200: queueListSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    async (request) => {
      return service.list(request.query)
    },
  )

  server.get(
    '/api/queues/:id',
    {
      config: { policy: STRUCTURE_POLICY },
      schema: {
        params: queueParamsSchema,
        response: {
          200: queueSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      return service.get(request.params.id)
    },
  )

  server.patch(
    '/api/queues/:id',
    {
      config: { policy: STRUCTURE_POLICY },
      schema: {
        params: queueParamsSchema,
        body: updateQueueBodySchema,
        response: {
          200: queueSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          413: errorResponseSchema,
          415: errorResponseSchema,
        },
      },
    },
    async (request) => {
      const updatedBy = requireUserId(request)
      return service.update(request.params.id, request.body, updatedBy)
    },
  )

  server.delete(
    '/api/queues/:id',
    {
      config: { policy: STRUCTURE_POLICY },
      schema: {
        params: queueParamsSchema,
        response: {
          204: z.null(),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await service.delete(request.params.id)
      reply.status(204)
      return null
    },
  )

  server.post(
    '/api/queues/:id/groups',
    {
      config: { policy: STRUCTURE_POLICY },
      schema: {
        params: queueParamsSchema,
        body: addQueueGroupBodySchema,
        response: {
          201: queueGroupSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          413: errorResponseSchema,
          415: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const group = await service.addGroup(request.params.id, request.body.groupId)
      reply.status(201)
      return group
    },
  )

  server.delete(
    '/api/queues/:id/groups/:groupId',
    {
      config: { policy: STRUCTURE_POLICY },
      schema: {
        params: queueGroupParamsSchema,
        response: {
          204: z.null(),
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await service.removeGroup(request.params.id, request.params.groupId)
      reply.status(204)
      return null
    },
  )

  server.get(
    '/api/queues/:id/tickets',
    {
      config: { policy: TICKET_POLICY },
      schema: {
        params: queueParamsSchema,
        querystring: listQueueTicketsQuerySchema,
        response: {
          200: ticketListSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      return service.listTickets(request.params.id, request.query)
    },
  )
}
