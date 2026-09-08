import { DeskIcon } from '@/components/pipodesk/icons'
import { ENROLLMENT_TYPE_COPY, documentLabel } from '@/constants/pipodesk/domain'
import copy from '@/constants/pages/pipodesk/ticket/documents'
import { formatLongDate } from '@/lib/pipodesk/format'
import type { RecordDocument, TicketRecords } from '@/lib/pipodesk/record'
import type { TicketRow } from '@/lib/pipodesk/ticket-row'
import { OutageNotice } from './OutageNotice'
import { RecordCard, RecordEmpty } from './RecordSection'
import styles from './DocumentsTab.module.css'

export interface DocumentsTabProps {
  ticket: TicketRow
  pendingDocumentation: string[] | null
  records: TicketRecords
}

function DocumentGroup({
  title,
  empty,
  documents,
}: {
  title: string
  empty: string
  documents: RecordDocument[]
}) {
  return (
    <RecordCard>
      <h2 className={styles.title}>{title}</h2>
      {documents.length === 0 ? (
        <RecordEmpty>{empty}</RecordEmpty>
      ) : (
        <ul className={styles.documents}>
          {documents.map((doc) => (
            <li key={doc.id}>
              <span className={styles.name}>{doc.name}</span>
              <span>{formatLongDate(doc.at)}</span>
              <span>{copy.size(doc.sizeKb)}</span>
              {/* There is no file behind the fixture; the control marks where the action lives. */}
              <button
                type="button"
                className={styles.download}
                aria-label={copy.download(doc.name)}
              >
                <DeskIcon name="download" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </RecordCard>
  )
}

export function DocumentsTab({ ticket, pendingDocumentation, records }: DocumentsTabProps) {
  const documents = records.documentsOf('ticket', ticket.id)
  const fromPipo = documents.filter((doc) => doc.origin === 'pipo')
  const fromClient = documents.filter((doc) => doc.origin === 'client')

  // What is missing comes from the ticket, not from what arrived: both facts show.
  const received = new Set(fromClient.map((doc) => doc.kind))
  const missing = (pendingDocumentation ?? []).map((key) => {
    const label = documentLabel(key)
    return { label, arrived: received.has(label) }
  })

  // Only an inclusion goes through Adobe Sign; the empty group says so instead of vanishing.
  const pipoEmpty =
    ticket.enrollmentType === 'inclusion'
      ? copy.fromPipo.empty
      : copy.fromPipo.notInclusion(
          ENROLLMENT_TYPE_COPY[ticket.enrollmentType] ?? ticket.enrollmentType,
        )

  return (
    <div className={styles.tab}>
      {records.isBackofficeDown(ticket.companyId) && <OutageNotice capturedAt={ticket.createdAt} />}

      {missing.length > 0 && (
        <RecordCard>
          <h2 className={styles.title}>{copy.missing.title}</h2>
          <ul className={styles.missing}>
            {missing.map(({ label, arrived }) => (
              <li key={label}>
                {label}
                {arrived && <span className={styles.arrived}> — {copy.missing.arrived}</span>}
              </li>
            ))}
          </ul>
        </RecordCard>
      )}

      <DocumentGroup
        title={copy.fromClient.title}
        empty={copy.fromClient.empty}
        documents={fromClient}
      />
      <DocumentGroup title={copy.fromPipo.title} empty={pipoEmpty} documents={fromPipo} />
    </div>
  )
}
