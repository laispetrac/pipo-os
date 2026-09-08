import { render, screen } from '@testing-library/react'
import { CompanyTab } from '@/components/pipodesk/ticket/CompanyTab'
import copy from '@/constants/pages/pipodesk/ticket/company'
import { company, recordsWith } from '../../../helpers/records'

describe('CompanyTab', () => {
  /** The fixture has no such company, but the API will: a section with a
   *  title and an empty list says nothing, like the other tabs' empties do. */
  it('should say when a company has no contracts, plans or files', () => {
    render(
      <CompanyTab
        companyId="company-1"
        policyId={undefined}
        records={recordsWith()}
        capturedAt="2026-08-01T12:00:00.000Z"
        today="2026-08-07"
      />,
    )

    expect(screen.getByText(copy.contract.empty)).toBeInTheDocument()
    expect(screen.getByText(copy.plans.empty)).toBeInTheDocument()
    expect(screen.getByText(copy.files.empty)).toBeInTheDocument()
  })

  /** A branch on the parent's policy: the cut to the ticket's policy cannot
   *  happen, so the whole list shows and the section says why. */
  it("should say the list is the whole company when the ticket policy is another company's", () => {
    const records = recordsWith({
      companies: [company('company-1'), company('company-2')],
      policies: [
        {
          id: 'policy-1',
          companyId: 'company-1',
          carrierId: 'carrier-1',
          product: 'health',
          name: 'Amil E1',
          code: '1000',
        },
      ],
    })
    render(
      <CompanyTab
        companyId="company-1"
        policyId="policy-da-matriz"
        records={records}
        capturedAt="2026-08-01T12:00:00.000Z"
        today="2026-08-07"
      />,
    )

    expect(screen.getByText('Amil E1')).toBeInTheDocument()
    expect(screen.getByText(copy.plans.otherCompany)).toBeInTheDocument()
  })

  it("should not warn when the ticket policy is one of the company's", () => {
    const records = recordsWith({
      policies: [
        {
          id: 'policy-1',
          companyId: 'company-1',
          carrierId: 'carrier-1',
          product: 'health',
          name: 'Amil E1',
          code: '1000',
        },
      ],
    })
    render(
      <CompanyTab
        companyId="company-1"
        policyId="policy-1"
        records={records}
        capturedAt="2026-08-01T12:00:00.000Z"
        today="2026-08-07"
      />,
    )

    expect(screen.queryByText(copy.plans.otherCompany)).not.toBeInTheDocument()
  })
})
