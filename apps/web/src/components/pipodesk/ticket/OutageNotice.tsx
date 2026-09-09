import { Banner } from '@piposaude/design-system'
import recordCopy from '@/constants/pages/pipodesk/ticket/record'
import { formatLongDate } from '@/lib/pipodesk/format'
import styles from './OutageNotice.module.css'

/** The Backoffice is down for this company: the tab shows the saved picture.
 *  `capturedAt` is the ticket's — the record has no capture date of its own. */
export function OutageNotice({ capturedAt }: { capturedAt: string }) {
  return (
    <Banner variant="warning" title={recordCopy.outage.title} className={styles.notice}>
      {recordCopy.outage.body(formatLongDate(capturedAt))}
    </Banner>
  )
}
