/** Each document the EI asks for. `spellings` are the EI's own — the key as
 *  `pendingDocumentation` writes it and the `kind` its files carry; `label` is copy. */
const DOCUMENTS = [
  { key: 'rg', label: 'RG', spellings: ['rg', 'RG'] },
  { key: 'cpf', label: 'CPF', spellings: ['cpf', 'CPF'] },
  {
    key: 'comprovante-residencia',
    label: 'comprovante de residência',
    spellings: ['comprovante-residencia', 'comprovante_residencia', 'Comprovante de residência'],
  },
] as const

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const KEY_BY_SPELLING = new Map<string, string>(
  DOCUMENTS.flatMap((doc) => doc.spellings.map((spelling) => [normalize(spelling), doc.key])),
)

const LABEL_BY_KEY = new Map<string, string>(DOCUMENTS.map((doc) => [doc.key, doc.label]))

/** Any EI spelling — a pendency key or a file's kind — to the one key that
 *  names the document. Unknowns keep their own normalised form, never a label. */
export const documentKey = (value: string): string =>
  KEY_BY_SPELLING.get(normalize(value)) ?? normalize(value)

export function documentLabel(key: string): string {
  const label = LABEL_BY_KEY.get(documentKey(key)) ?? key
  return label.charAt(0).toUpperCase() + label.slice(1)
}
