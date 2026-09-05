// Roots in camelCase; each one expands to the three spellings below, so the
// field is redacted whichever the writer used.
const PII_ROOTS = [
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
  'birthDate',
  // Redacted whole: these hold a person in free-form jsonb, with no closed shape.
  'enrollmentSnapshot',
  'requester',
  'collaborators',
] as const

const kebabOf = (root: string): string => root.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
const snakeOf = (root: string): string => root.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

// A single-word root yields three identical spellings; the Set collapses them.
const PII_FIELDS = [...new Set(PII_ROOTS.flatMap((root) => [root, kebabOf(root), snakeOf(root)]))]

// fast-redact syntax: each `*` matches exactly one level, so a path per depth.
export const PII_REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  ...PII_FIELDS,
  ...PII_FIELDS.map((field) => `*.${field}`),
  ...PII_FIELDS.map((field) => `*.*.${field}`),
]
