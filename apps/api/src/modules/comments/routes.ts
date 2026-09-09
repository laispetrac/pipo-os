import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import type { FastifyInstance } from 'fastify'
import { requireUserId } from '../auth/authenticate.js'
import { errorResponseSchema } from '../../shared/schemas.js'
import { ticketParamsSchema } from '../tickets/schemas.js'
import { TICKET_POLICY } from '../tickets/policy.js'
import {
  commentListSchema,
  commentSchema,
  createCommentBodySchema,
  timelineQuerySchema,
  timelineSchema,
} from './schemas.js'
import type { CommentsService } from './service.js'

export function registerCommentRoutes(app: FastifyInstance, service: CommentsService): void {
  const server = app.withTypeProvider<ZodTypeProvider>()

  server.get(
    '/api/tickets/:id/comments',
    {
      config: { policy: TICKET_POLICY },
      schema: {
        params: ticketParamsSchema,
        response: {
          200: commentListSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      return service.list(request.params.id)
    },
  )

  server.get(
    '/api/tickets/:id/timeline',
    {
      config: { policy: TICKET_POLICY },
      schema: {
        params: ticketParamsSchema,
        querystring: timelineQuerySchema,
        response: {
          200: timelineSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request) => {
      // TODO: no portfolio filter yet, so a policy holder reads the chronology of
      // any company's ticket, internal comments included (ACE-147)
      return service.timeline(request.params.id, request.query)
    },
  )

  server.post(
    '/api/tickets/:id/comments',
    {
      config: { policy: TICKET_POLICY },
      // A quarter of the global limit, and four times the 50k characters the
      // schema accepts, so even an all-4-byte body reaches the field check.
      bodyLimit: 262_144,
      schema: {
        params: ticketParamsSchema,
        body: createCommentBodySchema,
        response: {
          201: commentSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          413: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const authorId = requireUserId(request)
      const comment = await service.add(request.params.id, request.body, authorId)
      reply.status(201)
      return comment
    },
  )
}
