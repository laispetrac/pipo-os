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

  it('defaults to the in-cluster address of the internal listener', () => {
    expect(authConfig().authServiceInternalUrl).toBe('http://auth-service.platform:4000')
  })
})
