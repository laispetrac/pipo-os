// @vitest-environment node
import { carrierSlug } from '@/lib/pipodesk/carrier'

describe('carrierSlug', () => {
  it('should map the carriers of the fixture to the design-system logo slugs', () => {
    expect(carrierSlug('Unimed Mineira')).toBe('seguros-unimed')
    expect(carrierSlug('NotreDame Intermédica')).toBe('gndi')
    expect(carrierSlug('SulAmérica')).toBe('sulamerica')
  })

  it('should pass an unknown carrier through, so the DS falls back to its generic logo', () => {
    expect(carrierSlug('Vidalink')).toBe('Vidalink')
  })
})
