import { z } from 'zod'

// Every module used to declare its own copy of this under the same OpenAPI id,
// which only produced one component because the last registration wins.
export const errorResponseSchema = z
  .object({ error: z.string(), message: z.string() })
  .meta({ id: 'ErrorResponse' })
