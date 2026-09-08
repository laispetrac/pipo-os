import type { Priority } from '@/lib/pipodesk/ticket-row'
/** pt-BR copy for domain values from the snapshot. Missing keys fall back to
 *  the raw value — EI may ship a product before the UI learns its name. */
export const PRODUCT_COPY: Record<string, string> = {
  health: 'Saúde',
  dental: 'Odonto',
  life: 'Vida',
  pharmacy: 'Farmácia',
  gym: 'Academia',
  pet: 'Pet',
}

export const ENROLLMENT_TYPE_COPY: Record<string, string> = {
  inclusion: 'Inclusão',
  exclusion: 'Exclusão',
  plan_change: 'Alteração',
  registration_data_change: 'Alteração cadastral',
}

export const COMPANY_SIZE_COPY: Record<string, string> = {
  pme: 'PME',
  'pme-plus': 'PME+',
  enterprise: 'Empresarial',
}

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

export const MARITAL_STATUS_COPY: Record<string, string> = {
  single: 'Solteiro(a)',
  married: 'Casado(a)',
  divorced: 'Divorciado(a)',
  widowed: 'Viúvo(a)',
  'domestic-partnership': 'União estável',
}

/** The Backoffice label is "Sexo atribuído ao nascimento"; the values are these two. */
export const SEX_COPY: Record<string, string> = {
  f: 'Feminino',
  m: 'Masculino',
}

export const RELATIONSHIP_COPY: Record<string, string> = {
  holder: 'Titular',
  dependent: 'Dependente',
  'family-group': 'G. Familiar',
}

/** `Record<Priority, …>`, não `Record<string, …>`: uma prioridade nova sem
 *  entrada aqui passa a ser erro de compilação, não rótulo vazio. */
export const PRIORITY_COPY: Record<Priority, string> = {
  urgent: 'Urgente',
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

/** A estrutura da empresa. Matriz é a estipulante, filial é a sub-estipulante;
 *  o par do contrato não entra no valor. */
export const COMPANY_STRUCTURE_COPY = {
  parent: 'Matriz',
  branch: (parentName: string) => `Filial de ${parentName}`,
}
