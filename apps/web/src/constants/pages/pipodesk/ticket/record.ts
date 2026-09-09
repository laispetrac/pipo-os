/** A sentence in segments; the odd positions are emphasised. */
export type Emphasized = readonly string[]

/** Copy the four record tabs share. */
export default {
  notFound: {
    person: 'Beneficiário não encontrado.',
    company: 'Empresa não encontrada.',
  },
  /** The Backoffice is down for this company: what shows is the saved picture. */
  outage: {
    title: 'O Backoffice não respondeu',
    body: (date: string) => `O que está abaixo é o retrato salvo em ${date}, não o dado ao vivo.`,
  },
}
