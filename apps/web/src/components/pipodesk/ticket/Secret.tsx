import { useState } from 'react'
import { DeskIcon } from '@/components/pipodesk/icons'
import constants from '@/constants/pipodesk/secret'
import styles from './Secret.module.css'

export interface SecretProps {
  value: string
  /** What the value is (`senha do portal`), for the eye and the mask to announce. */
  label: string
}

/** Masked at rest; the eye reveals and hides. Copying is the caller's `CopyButton`. */
export function Secret({ value, label }: SecretProps) {
  const [visible, setVisible] = useState(false)

  return (
    <>
      <span className={visible ? `${styles.value} ${styles.visible}` : styles.value}>
        {visible ? (
          value
        ) : (
          <>
            {/* The dots are decoration; the hidden text is what gets announced. */}
            <span aria-hidden="true">{constants.mask}</span>
            <span className={styles.srOnly}>{constants.hidden(label)}</span>
          </>
        )}
      </span>
      <button
        type="button"
        className={styles.eye}
        aria-pressed={visible}
        aria-label={visible ? constants.hide(label) : constants.show(label)}
        title={visible ? constants.hideTitle : constants.showTitle}
        onClick={() => setVisible((current) => !current)}
      >
        <DeskIcon name={visible ? 'eye-off' : 'eye'} size={14} />
      </button>
    </>
  )
}
