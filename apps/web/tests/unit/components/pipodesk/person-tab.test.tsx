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

  /** The badge and the note say the account is the holder's. They must read
   *  whose account it is, not the role: a dependent may have one of their own. */
  it("should not call the account the holder's when the dependent has one", () => {
    const account = {
      holderName: 'Dep',
      holderCpf: '00000000000',
      bank: '033 - BANCO SANTANDER S.A.',
      agency: '0001',
      account: '12345-6',
    }
    const records = recordsWith({
      beneficiaries: [
        person('holder', { bankAccount: { ...account, holderName: 'Titular' } }),
        person('dep', { role: 'dependent', holderId: 'holder', bankAccount: account }),
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

    const refund = screen
      .getByRole('heading', { level: 3, name: copy.sections.refund })
      .closest('section')!
    expect(
      within(refund).getByText(copy.refund.fields.holderName).nextElementSibling,
    ).toHaveTextContent('Dep')
    expect(screen.queryByText(copy.refund.holderBadge)).not.toBeInTheDocument()
    expect(screen.queryByText(copy.refund.dependentNote[1])).not.toBeInTheDocument()
  })

  it("should say the account is the holder's when the dependent has none", () => {
    const account = {
      holderName: 'Titular',
      holderCpf: '00000000000',
      bank: '033 - BANCO SANTANDER S.A.',
      agency: '0001',
      account: '12345-6',
    }
    const records = recordsWith({
      beneficiaries: [
        person('holder', { bankAccount: account }),
        person('dep', { role: 'dependent', holderId: 'holder' }),
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

    expect(screen.getByText(copy.refund.holderBadge)).toBeInTheDocument()
    expect(screen.getByText(copy.refund.dependentNote[1])).toBeInTheDocument()
  })
})
