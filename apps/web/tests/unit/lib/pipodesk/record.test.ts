// @vitest-environment node
import {
  displayNameOf,
  historyOf,
  indexRecords,
  type Company,
  type Person,
  type RecordSource,
} from '@/lib/pipodesk/record'
import type { TicketRow } from '@/lib/pipodesk/ticket-row'

const person = (id: string, overrides: Partial<Person> = {}): Person => ({
  id,
  name: `Pessoa ${id}`,
  socialName: null,
  cpf: '00000000000',
  birthDate: '1990-01-01',
  sex: 'f',
  email: `${id}@exemplo.com`,
  phone: '(11) 90000-0000',
  maritalStatus: 'single',
  weightKg: null,
  heightCm: null,
  motherName: 'Mãe',
  address: {
    zip: '01000000',
    street: 'R. UM',
    district: 'CENTRO',
    number: '1',
    complement: null,
    uf: 'SP',
    city: 'São Paulo',
  },
  bankAccount: null,
  role: 'holder',
  holderId: null,
  link: {
    companyId: 'company-1',
    contractType: 'clt',
    admissionDate: '2020-01-01',
    salaryCents: 0,
    registration: '1',
    jobTitle: null,
    costCenter: null,
  },
  cards: [],
  ...overrides,
})

const company = (id: string, parentId: string | null): Company => ({
  id,
  tradeName: `Empresa ${id}`,
  legalName: `Empresa ${id} ME`,
  cnpj: '00.000.000/0001-00',
  parentId,
  porte: 'pme',
  contractualSla: null,
})

const source: RecordSource = {
  companies: [
    company('company-1', null),
    company('company-2', 'company-1'),
    company('company-3', 'company-1'),
  ],
  carriers: [{ id: 'carrier-1', name: 'Amil', portal: 'portal.amil.exemplo' }],
  policies: [
    {
      id: 'policy-1',
      companyId: 'company-1',
      carrierId: 'carrier-1',
      product: 'health',
      name: 'Amil E1',
      code: '1000',
    },
    {
      id: 'policy-2',
      companyId: 'company-2',
      carrierId: 'carrier-1',
      product: 'dental',
      name: 'Amil D1',
      code: '1001',
    },
  ],
  contracts: [
    {
      id: 'contract-1',
      number: '123456',
      companyId: 'company-1',
      carrierId: 'carrier-1',
      product: 'health',
      startDate: '2025-01-01',
      endDate: '2027-01-01',
      hasPendingFile: false,
      access: null,
    },
  ],
  documents: [
    {
      id: 'doc-1',
      name: 'RG.pdf',
      scope: 'ticket',
      scopeId: '700001',
      origin: 'client',
      kind: 'RG',
      at: '2026-07-01',
      sizeKb: 10,
    },
    {
      id: 'doc-2',
      name: 'QSA.pdf',
      scope: 'company',
      scopeId: 'company-1',
      origin: 'pipo',
      kind: 'QSA',
      at: '2026-01-15',
      sizeKb: 20,
    },
    {
      id: 'doc-3',
      name: 'Contrato.pdf',
      scope: 'contract',
      scopeId: 'contract-1',
      origin: 'pipo',
      kind: 'contrato',
      at: '2025-01-01',
      sizeKb: 30,
    },
  ],
  beneficiaries: [
    person('holder'),
    person('dep-1', { role: 'dependent', holderId: 'holder' }),
    person('dep-2', { role: 'dependent', holderId: 'holder' }),
    person('other'),
  ],
  tickets: [
    {
      id: '700001',
      beneficiaryId: 'holder',
      dependentIds: [],
      policyId: 'policy-1',
      pendingDocumentation: ['rg'],
    },
    {
      id: '700002',
      beneficiaryId: 'holder',
      dependentIds: ['dep-1'],
      policyId: 'policy-1',
      pendingDocumentation: null,
    },
    {
      id: '700003',
      beneficiaryId: 'other',
      dependentIds: [],
      policyId: 'policy-2',
      pendingDocumentation: null,
    },
  ],
  boOutageCompanyIds: ['company-2'],
}

const records = indexRecords(source)

describe('indexRecords', () => {
  it('should list the dependents of a holder in source order, and none for a holder without them', () => {
    expect(records.dependentsOf('holder').map((p) => p.id)).toEqual(['dep-1', 'dep-2'])
    expect(records.dependentsOf('other')).toEqual([])
  })

  it('should list the branches of a parent company', () => {
    expect(records.branchesOf('company-1').map((c) => c.id)).toEqual(['company-2', 'company-3'])
    expect(records.branchesOf('company-2')).toEqual([])
  })

  it('should index documents by scope, so a ticket id never matches a company id', () => {
    expect(records.documentsOf('ticket', '700001').map((d) => d.id)).toEqual(['doc-1'])
    expect(records.documentsOf('company', 'company-1').map((d) => d.id)).toEqual(['doc-2'])
    expect(records.documentsOf('contract', 'contract-1').map((d) => d.id)).toEqual(['doc-3'])
    expect(records.documentsOf('ticket', 'company-1')).toEqual([])
  })

  it('should find the policies and contracts of a company', () => {
    expect(records.policiesOf('company-1').map((p) => p.id)).toEqual(['policy-1'])
    expect(records.contractsOf('company-1').map((c) => c.id)).toEqual(['contract-1'])
    expect(records.contractsOf('company-3')).toEqual([])
  })

  it('should resolve the movement of a ticket, or nothing for an unknown id', () => {
    expect(records.movementOf('700001')?.beneficiaryId).toBe('holder')
    expect(records.movementOf('nope')).toBeUndefined()
  })

  it('should know which companies have the Backoffice down', () => {
    expect(records.isBackofficeDown('company-2')).toBe(true)
    expect(records.isBackofficeDown('company-1')).toBe(false)
  })
})

const row = (id: string, createdAt: string, closedAt: string | null = null): TicketRow => ({
  id,
  displayNumber: null,
  enrollmentId: `enr-${id}`,
  companyId: 'company-1',
  status: closedAt ? 'completed' : 'broker-processing',
  display: closedAt ? 'completed' : 'broker-processing',
  reason: null,
  subject: id,
  beneficiaryName: null,
  taxId: null,
  companyName: null,
  parentCompanyId: null,
  parentCompanyName: null,
  companySize: null,
  carrierId: 'carrier-1',
  carrierName: 'Amil',
  product: 'health',
  enrollmentType: 'inclusion',
  contractType: 'clt',
  relationship: 'holder',
  assigneeId: null,
  groupId: 'pod-1',
  priority: null,
  actionDate: null,
  tags: [],
  sourceSystem: 'enrollment-integrations',
  createdAt,
  updatedAt: createdAt,
  closedAt,
})

describe('historyOf', () => {
  const rows = [
    row('700001', '2026-07-01T12:00:00.000Z'),
    row('700002', '2026-08-01T12:00:00.000Z', '2026-08-05T12:00:00.000Z'),
    row('700003', '2026-08-02T12:00:00.000Z'),
  ]

  it('should return every ticket of the same beneficiary, newest first, closed and current included', () => {
    expect(historyOf(rows, records, '700001').map((r) => r.id)).toEqual(['700002', '700001'])
  })

  it('should return nothing for a ticket without a movement', () => {
    expect(historyOf(rows, records, 'nope')).toEqual([])
  })
})

describe('displayNameOf', () => {
  it('should prefer the social name when there is one', () => {
    expect(displayNameOf(person('a', { name: 'Carlos', socialName: 'Carla' }))).toBe('Carla')
    expect(displayNameOf(person('b', { name: 'Ana' }))).toBe('Ana')
  })
})
