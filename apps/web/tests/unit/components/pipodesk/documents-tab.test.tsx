import { render, screen, within } from '@testing-library/react'
import { DocumentsTab } from '@/components/pipodesk/ticket/DocumentsTab'
import copy from '@/constants/pages/pipodesk/ticket/documents'
import { documentLabel } from '@/lib/pipodesk/document'
import type { TicketRow } from '@/lib/pipodesk/ticket-row'
import { recordsWith } from '../../../helpers/records'

const row = {
  id: '700001',
  companyId: 'company-1',
  enrollmentType: 'inclusion',
  createdAt: '2026-08-01T12:00:00.000Z',
} as TicketRow

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
    expect(within(missing).getByRole('listitem')).toHaveTextContent(
      documentLabel('comprovante-residencia'),
    )
  })

  /** Fora do catálogo o rótulo é a própria grafia, e aí qual delas sobra é
   *  observável: é a primeira, a ordem em que a EI escreveu a pendência. */
  it('should keep the first spelling when the document is not in the catalogue', () => {
    render(
      <DocumentsTab
        ticket={row}
        pendingDocumentation={['certidao-nascimento', 'CERTIDAO_NASCIMENTO']}
        records={recordsWith()}
      />,
    )

    const missing = screen
      .getByRole('heading', { level: 2, name: copy.missing.title })
      .closest('section')!
    const [item] = within(missing).getAllByRole('listitem')
    expect(within(missing).getAllByRole('listitem')).toHaveLength(1)
    expect(item).toHaveTextContent('Certidao-nascimento')
  })
})
