import { useEffect, useState } from 'react'
import { DeskIcon } from '@/components/pipodesk/icons'
import constants from '@/constants/pipodesk/copy-button'
import styles from './CopyButton.module.css'

export interface CopyButtonProps {
  value: string
  /** The accessible name: what gets copied (`Copiar o ID 705639`). */
  label: string
  className?: string
}

/** Hidden at rest; a parent reveals it with `:hover [data-copy-button]`. */
export function CopyButton({ value, label, className }: CopyButtonProps) {
  // Copies inside the window: a counter, so a second click re-arms the timer.
  const [copies, setCopies] = useState(0)
  const copied = copies > 0

  // Cleared on unmount: copying and leaving inside the window set state on a gone component.
  useEffect(() => {
    if (copies === 0) return undefined
    const timer = window.setTimeout(() => setCopies(0), 1400)
    return () => window.clearTimeout(timer)
  }, [copies])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopies((count) => count + 1)
    } catch {
      // No clipboard (permission, iframe): the value stays selectable on screen.
    }
  }

  return (
    <button
      type="button"
      data-copy-button=""
      data-copied={copied ? 'true' : undefined}
      className={[styles.button, className].filter(Boolean).join(' ')}
      aria-label={label}
      title={copied ? constants.copied : label}
      onClick={copy}
    >
      <span className={styles.glyphs}>
        <DeskIcon name="copy" size={14} className={`${styles.glyph} ${styles.copyGlyph}`} />
        <DeskIcon name="check" size={14} className={`${styles.glyph} ${styles.checkGlyph}`} />
      </span>
      {/* Always mounted: a live region that appears with its text announces nothing. */}
      <span className={styles.tip} role="status" aria-live="polite">
        {copied ? constants.copied : ''}
      </span>
    </button>
  )
}
