import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
  type ZodFastifySchemaValidationError,
} from '@fastify/type-provider-zod'
import fp from 'fastify-plugin'
import { DomainError, type ErrorDetail } from '../shared/errors.js'

// The raw entries carry ajv/zod internals (schemaPath, params) that have no
// business in a published contract, so only these three cross the border.
function toErrorDetails(
  validation: ZodFastifySchemaValidationError[],
  context: string | undefined,
): ErrorDetail[] {
  return validation.map((entry) => ({
    field: entry.instancePath.slice(1).split('/').join('.') || (context ?? 'body'),
    message: entry.message ?? 'Invalid value',
    code: entry.keyword,
  }))
}

export default fp(
  async function errorHandlerPlugin(app) {
    app.setErrorHandler((error, request, reply) => {
      if (hasZodFastifySchemaValidationErrors(error)) {
        reply.status(400).send({
          error: 'RequestValidationError',
          message: 'Request validation failed',
          details: toErrorDetails(error.validation, error.validationContext),
        })
        return
      }

      if (isResponseSerializationError(error)) {
        request.log.error(error)
        reply.status(500).send({
          error: 'ResponseSerializationError',
          message: 'Response failed to match the schema',
        })
        return
      }

      if (error instanceof DomainError) {
        reply.status(error.statusCode).send({
          error: error.name,
          message: error.message,
          details: error.details,
        })
        return
      }

      request.log.error(error)
      reply.status(500).send({
        error: 'InternalServerError',
        message: 'Something went wrong',
      })
    })
  },
  { name: 'error-handler' },
)
