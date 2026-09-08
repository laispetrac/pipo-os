import type { ReactNode } from 'react'
import { Heading } from '@piposaude/design-system'
import type { Emphasized } from '@/constants/pages/pipodesk/ticket/record'
import styles from './RecordSection.module.css'

/** A titled section of a record tab; `badge` sits at the title's right. */
export function RecordSection({
  title,
  badge,
  children,
}: {
  title: string
  badge?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={styles.section}>
      <header className={styles.head}>
        <Heading level="h3" className={styles.title}>
          {title}
        </Heading>
        {badge}
      </header>
      {children}
    </section>
  )
}

/** The label/value grid: `dl` with one `div` per pair, as the DS list emits. */
export function RecordFields({ children }: { children: ReactNode }) {
  return <dl className={styles.fields}>{children}</dl>
}

export function RecordField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{children}</dd>
    </div>
  )
}

/** The bordered card, same as the page's blocks. */
export function RecordCard({ children }: { children: ReactNode }) {
  return <section className={styles.card}>{children}</section>
}

/** Gray note under the data: what the system says about itself, not a fact about this case. */
export function RecordNote({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>
}

export function RecordEmpty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>
}

export function Emphasis({ text }: { text: Emphasized }) {
  return (
    <>
      {text.map((segment, index) =>
        index % 2 === 1 ? <strong key={index}>{segment}</strong> : segment,
      )}
    </>
  )
}
