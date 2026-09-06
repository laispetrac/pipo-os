/* What never reaches a log line.
 *
 * **This only ever sees the object passed as the logger's first argument.**
 * `fast-redact` walks paths in that object; it does not read the message
 * string, so `log.info(`cpf=${cpf}`)` leaks in full and nothing here can stop
 * it. That is exactly why the root README tells everyone to pass data as the
 * first argument instead of interpolating it — and it is what makes the list
 * below load-bearing: the convention that keeps PII out of the message is the
 * same convention that routes it through here.
 */

/** Redacted as a single field: the value is replaced, the object around it is
 *  untouched. Roots in camelCase — each one expands to the three spellings
 *  below, so the field is covered whichever the writer used. */
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
] as const

/** Redacted **whole**: the entire object under the key disappears, not the
 *  fields inside it. These hold a person in free-form jsonb with no closed
 *  shape (PD-001), so redacting the container is the only rule that does not
 *  age together with the payload the EI sends. */
const PII_OBJECT_ROOTS = ['enrollmentSnapshot', 'requester', 'collaborators'] as const

/** Exported for their own tests: these two are what produce the coverage, so a
 *  regression here would silently narrow the list while every field-name test
 *  kept passing. */
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

/** How deep a field is still found. `fast-redact` matches exactly one level
 *  per `*`, so coverage is as deep as the paths written here and not one more:
 *  the field is redacted at the root, one nesting in, and two. At three it is
 *  not — `{ res: { body: { row: { taxId } } } }` leaks, and so does an array
 *  two levels in. That boundary is pinned by a test, so widening or narrowing
 *  it is a deliberate act rather than a side effect.
 *
 *  Three, and not more, because ACE-196 asked for the cost to be measured
 *  before the list grew. Measured (30k lines, same options, only `redact`
 *  changing): no redaction 0.7 µs/line, this list 28 µs, a fourth level 49 µs.
 *  A fourth level nearly doubles the price of every log line the service ever
 *  writes, to cover a shape the root README already tells people not to build
 *  — it says pass the data as the first argument, not a nested response body.
 *
 *  If the fourth level is ever wanted, the cheap way in is the spellings, not
 *  the depth: camelCase-only at four levels measured 24 µs — deeper coverage
 *  for less than this costs. It is not done here because dropping `tax-id` and
 *  `tax_id` trades a measured cost for an unmeasured hole, and this list is a
 *  security control. */
const MAX_DEPTH = 3

const nested = (depth: number): string[] =>
  PII_FIELDS.map((field) => `${'*.'.repeat(depth)}${field}`)

export const PII_REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  ...Array.from({ length: MAX_DEPTH }, (_, depth) => nested(depth)).flat(),
]
