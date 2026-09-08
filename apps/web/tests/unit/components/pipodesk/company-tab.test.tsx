import { render, screen } from '@testing-library/react'
import { CompanyTab } from '@/components/pipodesk/ticket/CompanyTab'
import copy from '@/constants/pages/pipodesk/ticket/company'
import { recordsWith } from '../../../helpers/records'

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
})
