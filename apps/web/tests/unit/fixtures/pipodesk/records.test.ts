// @vitest-environment node
import { queueSeed } from '@/fixtures/pipodesk/dataset'
import { records } from '@/fixtures/pipodesk/records'
import { displayNameOf } from '@/lib/pipodesk/record'

/** The two JSONs are generated together; a regeneration that breaks the link
 *  between them would only show up as an empty tab. */
describe('records fixture', () => {
  it('should link every queue row to a movement whose person and company exist', () => {
    const broken = queueSeed.filter((row) => {
      const movement = records.movementOf(row.id)
      return (
        !movement ||
        !records.personById.has(movement.beneficiaryId) ||
        !records.companyById.has(row.companyId) ||
        !records.policyById.has(movement.policyId)
      )
    })

    expect(broken.map((row) => row.id)).toEqual([])
  })

  it('should carry the picture of 705639, the ticket the plan uses as its reference', () => {
    const movement = records.movementOf('705639')!
    const person = records.personById.get(movement.beneficiaryId)!

    expect(displayNameOf(person)).toBe('Renata Henriques Junqueira')
    expect(records.companyById.get('company-275')?.tradeName).toBe('Caiçara Metalurgia')
  })
})
