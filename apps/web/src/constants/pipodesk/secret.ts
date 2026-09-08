export default {
  /** Ten dots for any value: the mask must not give the length away. */
  mask: '••••••••••',
  hidden: (label: string) => `${label} oculta`,
  show: (label: string) => `Mostrar a ${label}`,
  hide: (label: string) => `Ocultar a ${label}`,
  showTitle: 'Mostrar',
  hideTitle: 'Ocultar',
}
