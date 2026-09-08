import { describe, expect, it } from 'vitest'
import {
  ConflictError,
  ForbiddenError,
  UnprocessableEntityError,
  ValidationFailedError,
} from './errors.js'

describe('domain errors', () => {
  it('answers 403 under its own name when the session lacks the policy', () => {
    const error = new ForbiddenError('Missing policy admin/allow/administrate/ticket/*')

    expect(error.statusCode).toBe(403)
    expect(error.name).toBe('ForbiddenError')
    expect(error.message).toBe('Missing policy admin/allow/administrate/ticket/*')
    expect(error.details).toBeUndefined()
  })

  it('answers 422 under its own name when fields fail validation', () => {
    const error = new ValidationFailedError('Ticket cannot be completed', [
      { field: 'members.0.taxId', message: 'Required', code: 'invalid_type' },
    ])

    expect(error.statusCode).toBe(422)
    expect(error.name).toBe('ValidationFailedError')
  })

  it('keeps every field a validation failure was built with, not just the first', () => {
    const error = new ValidationFailedError('Ticket cannot be completed', [
      { field: 'members.0.taxId', message: 'Required', code: 'invalid_type' },
      { field: 'members.0.idCardNumber', message: 'Required', code: 'invalid_type' },
      { field: 'startDate', message: 'Earlier than the admission date', code: 'out_of_range' },
    ])

    expect(error.details).toEqual([
      { field: 'members.0.taxId', message: 'Required', code: 'invalid_type' },
      { field: 'members.0.idCardNumber', message: 'Required', code: 'invalid_type' },
      { field: 'startDate', message: 'Earlier than the admission date', code: 'out_of_range' },
    ])
  })

  // The status is shared with ValidationFailedError, so the name is what tells a
  // state-machine refusal from a field one — and the routes already publish it.
  it('keeps answering a closed ticket under the name the routes already publish', () => {
    const error = new UnprocessableEntityError('Ticket abc is already closed')

    expect(error.statusCode).toBe(422)
    expect(error.name).toBe('UnprocessableEntityError')
    expect(error.details).toBeUndefined()
  })

  it('keeps the conflict name the anti-duplication test observes', () => {
    expect(new ConflictError('Enrollment already has an open ticket').name).toBe('ConflictError')
  })
})
