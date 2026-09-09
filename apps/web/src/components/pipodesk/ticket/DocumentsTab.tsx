import { DeskIcon } from '@/components/pipodesk/icons'
import { ENROLLMENT_TYPE_COPY } from '@/constants/pipodesk/domain'
import { documentKey, documentLabel } from '@/lib/pipodesk/document'
import copy from '@/constants/pages/pipodesk/ticket/documents'
import { formatLongDate } from '@/lib/pipodesk/format'
import type { RecordDocument, TicketRecords } from '@/lib/pipodesk/record'
import type { TicketRow } from '@/lib/pipodesk/ticket-row'
import { OutageNotice } from './OutageNotice'
import { RecordEmpty, RecordNote, RecordSection } from './RecordSection'
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
    <RecordSection level="h2" title={title}>
      {documents.length === 0 ? (
        <RecordEmpty>{empty}</RecordEmpty>
      ) : (
        <ul className={styles.documents}>
          {documents.map((doc) => (
            <li key={doc.id}>
              <span className={styles.name}>{doc.name}</span>
              <span>{formatLongDate(doc.at)}</span>
              <span>{copy.size(doc.sizeKb)}</span>
              {/* No file behind the fixture: the control marks where the action lives, off. */}
              <button
                type="button"
                className={styles.download}
                aria-label={copy.download(doc.name)}
                disabled
              >
                <DeskIcon name="download" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </RecordSection>
  )
}

export function DocumentsTab({ ticket, pendingDocumentation, records }: DocumentsTabProps) {
  const documents = records.documentsOf('ticket', ticket.id)
  const fromPipo = documents.filter((doc) => doc.origin === 'pipo')
  const fromClient = documents.filter((doc) => doc.origin === 'client')

  // What is missing comes from the ticket, not from what arrived: both facts show.
  // Matched on the normalised key, never on the label — copy must not steer it.
  const received = new Set(fromClient.map((doc) => documentKey(doc.kind)))
  // Keyed and deduplicated by the same key that decides equality: two spellings
  // of one document are one pendency, and the first one the EI wrote is the label.
  const byKey = new Map<string, string>()
  for (const spelling of pendingDocumentation ?? []) {
    const key = documentKey(spelling)
    if (!byKey.has(key)) byKey.set(key, spelling)
  }
  const missing = [...byKey].map(([key, spelling]) => ({
    key,
    label: documentLabel(spelling),
    arrived: received.has(key),
  }))

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
        <RecordSection level="h2" title={copy.missing.title}>
          <ul className={styles.missing}>
            {missing.map(({ key, label, arrived }) => (
              <li key={key}>
                {label}
                {arrived && <span className={styles.arrived}> — {copy.missing.arrived}</span>}
              </li>
            ))}
          </ul>
        </RecordSection>
      )}

      <DocumentGroup
        title={copy.fromClient.title}
        empty={copy.fromClient.empty}
        documents={fromClient}
      />
      <DocumentGroup title={copy.fromPipo.title} empty={pipoEmpty} documents={fromPipo} />
      {/* On screen, not in a title: a disabled button takes no focus. */}
      {documents.length > 0 && <RecordNote>{copy.downloadUnavailable}</RecordNote>}
    </div>
  )
}
