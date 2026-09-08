/** One field the caller got wrong. `code` is the machine token, `message` the
 *  readable half; the pt-BR copy for the user lives in the web's constants. */
export interface ErrorDetail {
  field: string
  message: string
  code: string
}

export abstract class DomainError extends Error {
  abstract readonly statusCode: number
  readonly details?: readonly ErrorDetail[]

  constructor(message: string, details?: readonly ErrorDetail[]) {
    super(message)
    this.details = details
  }
}

export class NotFoundError extends DomainError {
  readonly statusCode = 404

  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
  }
}

/** A parameter the schema cannot check on its own — an opaque cursor, say.
 *  Same status the Zod validation layer already returns for a bad query. */
export class BadRequestError extends DomainError {
  readonly statusCode = 400

  constructor(message: string) {
    super(message)
    this.name = 'BadRequestError'
  }
}

export class UnauthorizedError extends DomainError {
  readonly statusCode = 401

  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ConflictError extends DomainError {
  readonly statusCode = 409

  constructor(message: string) {
    super(message)
    this.name = 'ConflictError'
  }
}

export class ForbiddenError extends DomainError {
  readonly statusCode = 403

  constructor(message: string) {
    super(message)
    this.name = 'ForbiddenError'
  }
}

/** The state machine refused: a closed ticket, a status that cannot follow the
 *  current one. Field-level refusals are ValidationFailedError instead. */
export class UnprocessableEntityError extends DomainError {
  readonly statusCode = 422

  constructor(message: string) {
    super(message)
    this.name = 'UnprocessableEntityError'
  }
}

export class ValidationFailedError extends DomainError {
  readonly statusCode = 422

  constructor(message: string, details: readonly ErrorDetail[]) {
    super(message, details)
    this.name = 'ValidationFailedError'
  }
}
