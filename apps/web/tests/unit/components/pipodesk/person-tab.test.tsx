import { render, screen, within } from '@testing-library/react'
import { PersonTab } from '@/components/pipodesk/ticket/PersonTab'
import copy from '@/constants/pages/pipodesk/ticket/person'
import recordCopy from '@/constants/pages/pipodesk/ticket/record'
import { company, person, recordsWith } from '../../../helpers/records'

describe('PersonTab', () => {
  /** The labels say "do titular"; the values must be the holder's even when
   *  the record gives the dependent an employment link of their own. */
  it('should show the holder employment in Dados do titular for a dependent', () => {
    const records = recordsWith({
      beneficiaries: [
        person('holder', { link: { ...person('holder').link, registration: '47865' } }),
        person('dep', {
          role: 'dependent',
          holderId: 'holder',
          link: { ...person('dep').link, registration: '99999' },
        }),
      ],
    })
    render(
      <PersonTab
        personId="dep"
        records={records}
        capturedAt="2026-08-01T12:00:00.000Z"
        onSelectPerson={() => {}}
      />,
    )

    const holderSection = screen
      .getByRole('heading', { level: 3, name: copy.sections.holder })
      .closest('section')!
    expect(
      within(holderSection).getByText(copy.fields.registration).nextElementSibling,
    ).toHaveTextContent('47865')
  })

  /** Same source as the section above it: the company whose Backoffice is
   *  down is the holder's, whatever the dependent's own copy says. */
  it('should warn about the Backoffice of the holder company for a dependent', () => {
    const records = recordsWith({
      companies: [company('company-1'), company('company-2')],
      beneficiaries: [
        person('holder'),
        person('dep', {
          role: 'dependent',
          holderId: 'holder',
          link: { ...person('dep').link, companyId: 'company-2' },
        }),
      ],
      boOutageCompanyIds: ['company-1'],
    })
    render(
      <PersonTab
        personId="dep"
        records={records}
        capturedAt="2026-08-01T12:00:00.000Z"
        onSelectPerson={() => {}}
      />,
    )

    expect(screen.getByText(recordCopy.outage.title)).toBeInTheDocument()
  })
})
