/** Carrier name → design-system logo slug; an unknown name passes through and
 *  the DS draws its generic logo. Ported from the prototype's CARRIER_LOGO_SLUG. */
const CARRIER_LOGO_SLUG: Record<string, string> = {
  SulAmérica: 'sulamerica',
  'Porto Seguro': 'porto-seguro',
  'Bradesco Saúde': 'bradesco',
  Amil: 'amil',
  'NotreDame Intermédica': 'gndi',
  MetLife: 'metlife',
  Wellhub: 'wellhub',
  'Unimed Mineira': 'seguros-unimed',
}

export const carrierSlug = (name: string): string => CARRIER_LOGO_SLUG[name] ?? name
