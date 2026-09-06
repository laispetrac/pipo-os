/* Only ever sees the logger's first argument. An interpolated message is never
 * redacted — hence the README rule to pass data, not build a string. */

/** Roots in camelCase; each expands to kebab and snake below. */
const PII_FIELD_ROOTS = [
  'authorization',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'cpf',
  'email',
  'taxId',
  'address',
  'beneficiaryName',
  // The ticket subject, free text from the EI: the Zendesk convention ends it
  // with the beneficiary's name (98% of the fixture). Broad key on purpose.
  'title',
] as const

/** Redacted whole — free-form jsonb with no closed shape (PD-001). */
const PII_OBJECT_ROOTS = ['enrollmentSnapshot', 'requester', 'collaborators'] as const

/** Exported for their own tests: these produce the coverage. */
export const kebabOf = (root: string): string =>
  root.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
export const snakeOf = (root: string): string =>
  root.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

// A single-word root yields three identical spellings; the Set collapses them.
const PII_FIELDS = [
  ...new Set(
    [...PII_FIELD_ROOTS, ...PII_OBJECT_ROOTS].flatMap((root) => [
      root,
      kebabOf(root),
      snakeOf(root),
    ]),
  ),
]

/** Covers the root and two nestings; deeper leaks. Pinned by a test — a fourth
 *  level costs ~20 µs more per log line (measured, ACE-196). */
const MAX_DEPTH = 3

const nested = (depth: number): string[] =>
  PII_FIELDS.map((field) => `${'*.'.repeat(depth)}${field}`)

export const PII_REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  ...Array.from({ length: MAX_DEPTH }, (_, depth) => nested(depth)).flat(),
]
