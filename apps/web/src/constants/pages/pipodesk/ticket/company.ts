import type { Emphasized } from './record'

/** The Sobre a empresa tab: the Backoffice tabs Resumo, Filiais, Contratos,
 *  Prêmios and Arquivos as sections of one. */
export default {
  sections: {
    data: 'Dados da empresa',
    branches: 'Filiais',
    contracts: 'Contratos',
    plans: 'Prêmios',
    files: 'Arquivos',
  },
  fields: {
    legalName: 'Razão social',
    tradeName: 'Nome fantasia',
    cnpj: 'CNPJ',
    porte: 'Porte',
    structure: 'Vínculo',
  },
  structure: {
    parent: 'Matriz',
    branchOf: (parent: string) => `Filial de ${parent}`,
  },
  /** A spreadsheet fact, not a system field — and the tab says so. */
  slaNote: (hours: number, hasPenalty: boolean): Emphasized => [
    '',
    `SLA contratual de ${hours}h`,
    `${hasPenalty ? ', com multa.' : '.'} Este dado vive na planilha de particularidades, não em sistema (contexto-produto §6), então não é campo de sistema — é particularidade que alguém mantém à mão.`,
  ],
  contract: {
    active: 'Ativo',
    expired: 'Vencido',
    expiredWarning: 'Contrato com vigência vencida',
    number: 'Contrato nº',
    copyNumber: (number: string) => `Copiar o número do contrato ${number}`,
    files: (count: number) =>
      count === 0
        ? 'Sem arquivo anexado'
        : count === 1
          ? '1 arquivo anexado'
          : `${count} arquivos anexados`,
    pendingFile: ' · Arquivo pendente',
    portal: 'Portal',
    copyPortal: 'Copiar o endereço do portal',
    login: 'Login',
    copyLogin: 'Copiar o login do portal',
    password: 'Senha',
    passwordLabel: 'senha do portal',
    copyPassword: 'Copiar a senha do portal',
    passwordUpdated: (date: string) => `Senha atualizada em ${date}`,
    noAccess: 'Sem acesso ao portal cadastrado neste contrato',
    note: [
      'O número do contrato é o que o Backoffice mostra, e é o dado que o analista confere antes de movimentar. ',
      'Qual campo do BO ele é segue pergunta aberta',
      ' — para a Juka, se é dado de operação, ou para a Laís, se o backend precisa expor. O formato aqui é neutro de propósito, para não afirmar um padrão que ninguém confirmou. O acesso ao portal é o cofre da última aba do contrato no Backoffice, trazido para dentro do contrato; login e senha aqui são fabricados, e ',
      'quem pode revelar a senha',
      ' ainda não foi decidido.',
    ] as Emphasized,
    branchNote: (parent: string): Emphasized => [
      ` Esta empresa é filial (sub-estipulante) de ${parent}, e os contratos aqui são `,
      'os dela',
      ': matriz e filial podem ter contratos e benefícios diferentes. Se a regra real for a da apólice da matriz, contrato, prêmios e acesso ao portal passam a ser os da matriz — a confirmar com a Juka.',
    ],
  },
  files: {
    size: (kb: number) => `${kb} KB`,
    note: 'Estes são os documentos da empresa. Os da movimentação estão na aba Documentos, e os de contrato ficam com o contrato acima.',
  },
}
