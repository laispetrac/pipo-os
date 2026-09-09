import { render, screen, within } from '@testing-library/react'
import { DocumentsTab } from '@/components/pipodesk/ticket/DocumentsTab'
import copy from '@/constants/pages/pipodesk/ticket/documents'
import type { TicketRow } from '@/lib/pipodesk/ticket-row'
import { recordsWith } from '../../../helpers/records'

const row = { id: '700001', companyId: 'company-1', enrollmentType: 'inclusion' } as TicketRow

describe('DocumentsTab', () => {
  /** As duas grafias do comprovante nomeiam um documento, não dois — e é a
   *  chave normalizada que decide isso, então é ela que chaveia a lista. */
  it('should list one pendency for two spellings of the same document', () => {
    render(
      <DocumentsTab
        ticket={row}
        pendingDocumentation={['comprovante-residencia', 'comprovante_residencia']}
        records={recordsWith()}
      />,
    )

    const missing = screen
      .getByRole('heading', { level: 2, name: copy.missing.title })
      .closest('section')!
    expect(within(missing).getAllByRole('listitem')).toHaveLength(1)
  })
})
