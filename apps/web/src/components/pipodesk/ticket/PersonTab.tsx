import {
  Status,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@piposaude/design-system'
import { MARITAL_STATUS_COPY, PRODUCT_COPY, SEX_COPY } from '@/constants/pipodesk/domain'
import copy from '@/constants/pages/pipodesk/ticket/person'
import recordCopy from '@/constants/pages/pipodesk/ticket/record'
import {
  RECORD_EMPTY,
  formatCpf,
  formatHeight,
  formatLongDateWithYear,
  formatSalary,
  formatWeight,
  formatZip,
} from '@/lib/pipodesk/format'
import { displayNameOf, type Person, type TicketRecords } from '@/lib/pipodesk/record'
import { OutageNotice } from './OutageNotice'
import {
  Emphasis,
  RecordBlock,
  RecordEmpty,
  RecordField,
  RecordFields,
  RecordNote,
  RecordSection,
} from './RecordSection'
import styles from './PersonTab.module.css'

export interface PersonTabProps {
  /** Who is on screen — the page decides; the tab only asks to switch. */
  personId: string
  records: TicketRecords
  capturedAt: string
  onSelectPerson: (personId: string) => void
}

const or = (value: string | null | undefined): string => value || RECORD_EMPTY

const productsOf = (person: Person): string =>
  person.cards.map((card) => PRODUCT_COPY[card.product] ?? card.product).join(', ')

export function PersonTab({ personId, records, capturedAt, onSelectPerson }: PersonTabProps) {
  const person = records.personById.get(personId)
  if (!person) return <RecordEmpty>{recordCopy.notFound.person}</RecordEmpty>

  const isDependent = person.role === 'dependent'
  const holder = person.holderId ? records.personById.get(person.holderId) : undefined
  const dependents = records.dependentsOf(person.id)
  // The section is the holder's job whoever is on screen; never trust the copy on a dependent.
  const link = holder?.link ?? person.link
  const company = records.companyById.get(link.companyId)
  // A dependent has no account: the refund lands on the holder's, and the tab says so.
  const account = person.bankAccount ?? holder?.bankAccount ?? null

  return (
    <div className={styles.tab}>
      {/* The company of the shown person's holder, not the ticket's. */}
      {records.isBackofficeDown(link.companyId) && <OutageNotice capturedAt={capturedAt} />}

      <RecordBlock>
        <div className={styles.head}>
          <h2 className={styles.name}>{displayNameOf(person)}</h2>
          <Status variant="neutral">{isDependent ? copy.role.dependent : copy.role.holder}</Status>
        </div>
        {isDependent && holder && (
          <p className={styles.holderLink}>
            {copy.dependentOf}{' '}
            <button
              type="button"
              className={styles.personButton}
              onClick={() => onSelectPerson(holder.id)}
            >
              {displayNameOf(holder)}
            </button>
          </p>
        )}
        {isDependent && (
          <RecordNote>
            <Emphasis text={copy.dependentContact} />
          </RecordNote>
        )}
      </RecordBlock>

      <RecordSection title={copy.sections.personal}>
        <RecordFields>
          <RecordField label={copy.fields.id}>{person.id}</RecordField>
          {person.socialName && (
            <RecordField label={copy.fields.socialName}>{person.socialName}</RecordField>
          )}
          <RecordField label={copy.fields.name}>{person.name}</RecordField>
          <RecordField label={copy.fields.birthDate}>
            {formatLongDateWithYear(person.birthDate)}
          </RecordField>
          <RecordField label={copy.fields.cpf}>{formatCpf(person.cpf)}</RecordField>
          <RecordField label={copy.fields.sex}>{SEX_COPY[person.sex] ?? person.sex}</RecordField>
          <RecordField label={copy.fields.maritalStatus}>
            {MARITAL_STATUS_COPY[person.maritalStatus] ?? person.maritalStatus}
          </RecordField>
          <RecordField label={copy.fields.weight}>{formatWeight(person.weightKg)}</RecordField>
          <RecordField label={copy.fields.height}>{formatHeight(person.heightCm)}</RecordField>
          <RecordField label={copy.fields.motherName}>{person.motherName}</RecordField>
        </RecordFields>
        {person.socialName && (
          <RecordNote>
            <Emphasis text={copy.socialNameNote} />
          </RecordNote>
        )}
      </RecordSection>

      <RecordSection title={copy.sections.holder}>
        <RecordFields>
          <RecordField label={copy.fields.company}>{or(company?.tradeName)}</RecordField>
          <RecordField label={copy.fields.cnpj}>{or(company?.cnpj)}</RecordField>
          <RecordField label={copy.fields.admissionDate}>
            {formatLongDateWithYear(link.admissionDate)}
          </RecordField>
          <RecordField label={copy.fields.contractType}>
            {link.contractType.toUpperCase()}
          </RecordField>
          <RecordField label={copy.fields.salary}>{formatSalary(link.salaryCents)}</RecordField>
          <RecordField label={copy.fields.registration}>{link.registration}</RecordField>
          <RecordField label={copy.fields.jobTitle}>{or(link.jobTitle)}</RecordField>
          <RecordField label={copy.fields.costCenter}>{or(link.costCenter)}</RecordField>
        </RecordFields>
      </RecordSection>

      <RecordSection title={copy.sections.contact}>
        <RecordFields>
          {/* The record fabricates a contact for dependents; it is nobody's. */}
          {!isDependent && <RecordField label={copy.fields.email}>{person.email}</RecordField>}
          {!isDependent && <RecordField label={copy.fields.phone}>{person.phone}</RecordField>}
          <RecordField label={copy.fields.zip}>{formatZip(person.address.zip)}</RecordField>
          <RecordField label={copy.fields.street}>{person.address.street}</RecordField>
          <RecordField label={copy.fields.district}>{person.address.district}</RecordField>
          <RecordField label={copy.fields.number}>{person.address.number}</RecordField>
          <RecordField label={copy.fields.complement}>{or(person.address.complement)}</RecordField>
          <RecordField label={copy.fields.uf}>{person.address.uf}</RecordField>
          <RecordField label={copy.fields.city}>{person.address.city}</RecordField>
        </RecordFields>
      </RecordSection>

      <RecordSection
        title={copy.sections.refund}
        badge={
          isDependent ? <Status variant="neutral">{copy.refund.holderBadge}</Status> : undefined
        }
      >
        {account === null ? (
          <RecordEmpty>{copy.refund.empty}</RecordEmpty>
        ) : (
          <RecordFields>
            <RecordField label={copy.refund.fields.holderName}>{account.holderName}</RecordField>
            <RecordField label={copy.refund.fields.holderCpf}>
              {formatCpf(account.holderCpf)}
            </RecordField>
            <RecordField label={copy.refund.fields.bank}>{account.bank}</RecordField>
            <RecordField label={copy.refund.fields.agency}>{account.agency}</RecordField>
            <RecordField label={copy.refund.fields.account}>{account.account}</RecordField>
          </RecordFields>
        )}
        {isDependent && account !== null && (
          <RecordNote>
            <Emphasis text={copy.refund.dependentNote} />
          </RecordNote>
        )}
      </RecordSection>

      {dependents.length > 0 && (
        <RecordSection title={copy.sections.dependents}>
          <ul className={styles.dependents}>
            {dependents.map((dependent) => (
              <li key={dependent.id}>
                <button
                  type="button"
                  className={styles.dependentButton}
                  onClick={() => onSelectPerson(dependent.id)}
                >
                  <span>{displayNameOf(dependent)}</span>
                  <span className={styles.dependentMeta}>{formatCpf(dependent.cpf)}</span>
                  <span className={styles.dependentMeta}>
                    {productsOf(dependent) || copy.dependents.noBenefit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <RecordNote>
            <Emphasis text={copy.dependents.note} />
          </RecordNote>
        </RecordSection>
      )}

      <RecordSection title={copy.sections.cards}>
        {person.cards.length === 0 ? (
          <RecordEmpty>{copy.cards.empty}</RecordEmpty>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{copy.cards.carrier}</TableHeaderCell>
                <TableHeaderCell>{copy.cards.benefit}</TableHeaderCell>
                <TableHeaderCell>{copy.cards.number}</TableHeaderCell>
                <TableHeaderCell>{copy.cards.since}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {person.cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>
                    {records.carrierById.get(card.carrierId)?.name ?? card.carrierId}
                  </TableCell>
                  <TableCell>{PRODUCT_COPY[card.product] ?? card.product}</TableCell>
                  <TableCell className={styles.cardNumber}>{card.number}</TableCell>
                  <TableCell>{formatLongDateWithYear(card.validFrom)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </RecordSection>
    </div>
  )
}
