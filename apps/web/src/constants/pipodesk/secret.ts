export default {
  /** Ten dots for any value: the mask must not give the length away. */
  mask: '••••••••••',
  hidden: (label: string) => `${label} oculta`,
  /** The toggle keeps this name; `aria-pressed` carries the state. */
  show: (label: string) => `Mostrar a ${label}`,
  showTitle: 'Mostrar',
  hideTitle: 'Ocultar',
}
