import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '@/routeTree.gen'
import { queueSeed } from '@/fixtures/pipodesk/dataset'
import { records } from '@/fixtures/pipodesk/records'
import { displayNameOf } from '@/lib/pipodesk/record'
import { formatCpf, formatLongDate } from '@/lib/pipodesk/format'
import personCopy from '@/constants/pages/pipodesk/ticket/person'
import recordCopy from '@/constants/pages/pipodesk/ticket/record'

vi.mock('@/lib/auth', () => ({
  ensureSession: vi.fn().mockResolvedValue(undefined),
  isAuthenticated: vi.fn().mockReturnValue(true),
  logout: vi.fn(),
}))

async function openTab(path: string, tab: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(<RouterProvider router={router} />)
  await screen.findByRole('navigation', { name: /pipodesk/i })
  const user = userEvent.setup()
  await user.click(await screen.findByRole('tab', { name: tab }))
  return { router, user, panel: screen.getByRole('tabpanel') }
}

const rowOf = (ticketId: string) => queueSeed.find((row) => row.id === ticketId)!
const personOf = (ticketId: string) =>
  records.personById.get(records.movementOf(ticketId)!.beneficiaryId)!

/** `dt` → its `dd`: the field's value as the tab prints it. */
const fieldValue = (panel: HTMLElement, label: string) =>
  within(panel).getByText(label).nextElementSibling

describe('aba Dados pessoais', () => {
  /** 705639 is a holder with a bank account, one card and no dependents —
   *  every section of the Backoffice record shows, with the values it prints. */
  it('should show the Backoffice sections of the record, the cards and the role badge', async () => {
    const { panel } = await openTab('/tickets/705639', 'Dados pessoais')
    const renata = personOf('705639')

    expect(
      within(panel).getByRole('heading', { level: 2, name: displayNameOf(renata) }),
    ).toBeInTheDocument()
    expect(within(panel).getByText(personCopy.role.holder)).toBeInTheDocument()
    for (const title of [
      personCopy.sections.personal,
      personCopy.sections.holder,
      personCopy.sections.contact,
      personCopy.sections.refund,
      personCopy.sections.cards,
    ]) {
      expect(within(panel).getByRole('heading', { level: 3, name: title })).toBeInTheDocument()
    }

    expect(fieldValue(panel, personCopy.fields.cpf)).toHaveTextContent(formatCpf(renata.cpf))
    expect(fieldValue(panel, personCopy.fields.birthDate)).toHaveTextContent('17 de Agosto de 1981')
    expect(fieldValue(panel, personCopy.fields.maritalStatus)).toHaveTextContent('União estável')
    expect(fieldValue(panel, personCopy.fields.weight)).toHaveTextContent('57 kg')
    expect(fieldValue(panel, personCopy.fields.height)).toHaveTextContent('1,57 m')
    expect(fieldValue(panel, personCopy.fields.salary)).toHaveTextContent('R$ 6.100,00')
    expect(fieldValue(panel, personCopy.fields.costCenter)).toHaveTextContent('CC-300 Produção')
    // An empty field carries the Backoffice dash, not a blank.
    expect(fieldValue(panel, personCopy.fields.jobTitle)).toHaveTextContent('-')
    expect(fieldValue(panel, personCopy.fields.zip)).toHaveTextContent('83805-543')
    expect(fieldValue(panel, personCopy.refund.fields.bank)).toHaveTextContent(
      '033 - BANCO SANTANDER S.A.',
    )

    const cards = within(panel).getByRole('table')
    expect(within(cards).getByText('Unimed Mineira')).toBeInTheDocument()
    expect(within(cards).getByText('Vida')).toBeInTheDocument()
    expect(within(cards).getByText('2509597491')).toBeInTheDocument()
    expect(within(cards).getByText('17 de Janeiro de 2025')).toBeInTheDocument()
  })

  /** 700062 moves a dependent: contact is the holder's and stays out, the
   *  refund account is the holder's and says so, and the family is navigable
   *  both ways without leaving the tab. */
  it('should say a dependent has no contact of their own, and navigate to the holder and back', async () => {
    const { panel, user } = await openTab('/tickets/700062', 'Dados pessoais')
    const dependent = personOf('700062')
    const holder = records.personById.get(dependent.holderId!)!

    expect(
      within(panel).getByRole('heading', { level: 2, name: displayNameOf(dependent) }),
    ).toBeInTheDocument()
    expect(within(panel).getByText(personCopy.role.dependent)).toBeInTheDocument()
    expect(within(panel).getByText(personCopy.dependentContact[1])).toBeInTheDocument()
    expect(within(panel).queryByText(personCopy.fields.email)).not.toBeInTheDocument()
    expect(within(panel).getByText(personCopy.refund.holderBadge)).toBeInTheDocument()
    expect(fieldValue(panel, personCopy.refund.fields.holderName)).toHaveTextContent(holder.name)

    await user.click(within(panel).getByRole('button', { name: displayNameOf(holder) }))

    expect(
      within(panel).getByRole('heading', { level: 2, name: displayNameOf(holder) }),
    ).toBeInTheDocument()
    expect(within(panel).getByText(personCopy.role.holder)).toBeInTheDocument()
    expect(
      within(panel).getByRole('heading', { level: 3, name: personCopy.sections.dependents }),
    ).toBeInTheDocument()

    await user.click(
      within(panel).getByRole('button', { name: new RegExp(displayNameOf(dependent)) }),
    )

    expect(
      within(panel).getByRole('heading', { level: 2, name: displayNameOf(dependent) }),
    ).toBeInTheDocument()
  })

  /** The page does not remount between tickets — only the id changes — so
   *  the person picked on one ticket must not leak into the next. */
  it('should go back to the person of the ticket when another ticket opens', async () => {
    const { router, user } = await openTab('/tickets/700062', 'Dados pessoais')
    const holder = records.personById.get(personOf('700062').holderId!)!

    await user.click(screen.getByRole('button', { name: displayNameOf(holder) }))
    expect(
      screen.getByRole('heading', { level: 2, name: displayNameOf(holder) }),
    ).toBeInTheDocument()

    await router.navigate({ to: '/tickets/$id', params: { id: '705639' } })

    expect(
      await screen.findByRole('heading', { level: 2, name: displayNameOf(personOf('705639')) }),
    ).toBeInTheDocument()
  })

  it('should title the record with the social name and keep the registered name as a field', async () => {
    const { panel } = await openTab('/tickets/702350', 'Dados pessoais')
    const person = personOf('702350')

    expect(person.socialName).not.toBeNull()
    expect(
      within(panel).getByRole('heading', { level: 2, name: person.socialName! }),
    ).toBeInTheDocument()
    expect(fieldValue(panel, personCopy.fields.socialName)).toHaveTextContent(person.socialName!)
    expect(fieldValue(panel, personCopy.fields.name)).toHaveTextContent(person.name)
  })

  it('should warn that the record is a saved picture when the Backoffice is down for the company', async () => {
    const { panel } = await openTab('/tickets/700127', 'Dados pessoais')

    expect(records.isBackofficeDown(rowOf('700127').companyId)).toBe(true)
    expect(within(panel).getByText(recordCopy.outage.title)).toBeInTheDocument()
    expect(
      within(panel).getByText(recordCopy.outage.body(formatLongDate(rowOf('700127').createdAt))),
    ).toBeInTheDocument()
  })

  it('should keep the context column beside the record', async () => {
    const { panel } = await openTab('/tickets/705639', 'Dados pessoais')

    expect(
      within(panel).getByRole('complementary', { name: 'Contexto do chamado' }),
    ).toBeInTheDocument()
  })
})
