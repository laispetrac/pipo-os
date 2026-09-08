/** The Histórico tab: every ticket of the beneficiary, open and closed. */
export default {
  empty: 'Não há histórico para este beneficiário.',
  columns: {
    id: 'ID',
    movement: 'Movimentação',
    carrier: 'Operadora',
    openedAt: 'Aberto em',
    situation: 'Situação',
  },
  closedAt: (date: string) => `em ${date}`,
}
