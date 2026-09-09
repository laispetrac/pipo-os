import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { authConfig } from './config.js'

describe('authConfig', () => {
  const original = { ...process.env }

  beforeEach(() => {
    delete process.env.AUTH_SERVICE_INTERNAL_URL
  })

  afterEach(() => {
    process.env = { ...original }
  })

  it('reads the internal listener address', () => {
    process.env.AUTH_SERVICE_INTERNAL_URL = 'http://localhost:4000'

    expect(authConfig().authServiceInternalUrl).toBe('http://localhost:4000')
  })

  // Deliberately not requiredInProduction, unlike its neighbours: the internal
  // listener has one fixed in-cluster address, and failing the boot over a
  // missing integration variable would take the whole API down — including the
  // screens that do not depend on it. A wrong address surfaces as a 503 on the
  // service call, which is where the failure belongs.
  it('defaults to the in-cluster address of the internal listener', () => {
    expect(authConfig().authServiceInternalUrl).toBe('http://auth-service.platform:4000')
  })
})
