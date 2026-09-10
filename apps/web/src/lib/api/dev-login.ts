// Dev-only escape hatch. The endpoint is deliberately absent from the OpenAPI
// contract (so it never reaches the generated client or the published spec),
// which is why this is the one call that cannot go through `client`. It still
// lives in lib/api so every server call stays in this layer.
//
// Callers must guard on `import.meta.env.DEV` so Vite drops this from the
// production bundle at build time.
// What the Pipodesk routes require: without them the local session logs in and
// then gets 403 — `ticket` on every chamado endpoint, `structure` on pods and
// queues. Spelled out instead of `pipodesk/*` so both doors stay visible here.
export const DEV_POLICIES = [
  'admin/allow/administrate/pipodesk/ticket',
  'admin/allow/administrate/pipodesk/structure',
]

// Explicit on purpose: a default would hand out a privileged session to a
// caller that meant to exercise one without policies.
export async function devLogin(policies: string[]): Promise<void> {
  const response = await fetch('/api/auth/dev-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ policies }),
  })

  if (!response.ok) {
    throw new Error(`dev login failed with status ${response.status}`)
  }
}
