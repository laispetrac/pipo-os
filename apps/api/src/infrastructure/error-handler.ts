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
  // Everything but the body is prefixed: a bare `id` cannot tell a bad path
  // param from a body field with the same name.
  const prefix = context === undefined || context === 'body' ? '' : `${context}.`

  return validation.map((entry) => {
    const path = entry.instancePath.slice(1).split('/').join('.')
    return {
      field: path ? `${prefix}${path}` : (context ?? 'body'),
      message: entry.message ?? 'Invalid value',
      code: entry.keyword,
    }
  })
}

// The handler receives `unknown`, and a Fastify error (FST_ERR_CTP_*) carries
// the status the client needs — 413 for a body too large, 415 for a media type
// with no parser.
interface ClientError {
  statusCode: number
  code: string
  message?: string
}

// `error` in the body is our error name everywhere else, so a framework code
// like FST_ERR_CTP_BODY_TOO_LARGE must not leak into it.
const CLIENT_ERROR_NAMES: Record<number, string> = {
  400: 'BadRequestError',
  405: 'MethodNotAllowedError',
  406: 'NotAcceptableError',
  413: 'PayloadTooLargeError',
  415: 'UnsupportedMediaTypeError',
}

function isClientError(error: unknown): error is ClientError {
  // `unknown` is honest here: a handler can throw anything, including null, and
  // reading a property off it would fail inside the handler that exists to
  // stop failures.
  if (typeof error !== 'object' || error === null) {
    return false
  }

  // The FST_ prefix is the whole point: a library error that happens to carry a
  // 4xx (an HTTP client, the driver) would mirror its internal message outward.
  const { statusCode: status, code } = error as { statusCode?: unknown; code?: unknown }
  return (
    typeof status === 'number' &&
    status >= 400 &&
    status < 500 &&
    typeof code === 'string' &&
    code.startsWith('FST_')
  )
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

      // The library predicate only looks for a `method` key, which an HTTP
      // client's error also carries; the code is what makes it ours.
      if (isResponseSerializationError(error) && error.code === 'FST_ERR_RESPONSE_SERIALIZATION') {
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

      // Before the fallback: without this, what the caller sent wrong came back
      // as a 500 of ours.
      if (isClientError(error)) {
        request.log.warn({ err: error }, 'client error')
        reply.status(error.statusCode).send({
          error: CLIENT_ERROR_NAMES[error.statusCode] ?? 'ClientError',
          message: error.message ?? 'Request refused',
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
