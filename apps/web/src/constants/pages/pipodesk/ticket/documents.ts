/** The Documentos tab reads what the Backoffice produced; it generates nothing. */
export default {
  missing: {
    title: 'Ainda falta',
    /* The pendency is what the ticket states; a file arriving does not close it. */
    arrived: 'arquivo recebido, pendência aberta',
  },
  fromClient: {
    title: 'Recebidos do cliente',
    empty: 'Nada recebido do cliente neste chamado.',
  },
  fromPipo: {
    title: 'Gerados pela Pipo',
    empty: 'Nenhum documento gerado pela Pipo para este chamado.',
    notInclusion: (type: string) =>
      `${type} não gera ficha de adesão — só a inclusão passa pelo Adobe Sign.`,
  },
  download: (name: string) => `Baixar ${name}`,
  downloadUnavailable: 'Ainda não há arquivo para baixar.',
  size: (kb: number) => `${kb} KB`,
}
