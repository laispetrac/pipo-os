import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CopyButton } from '@/components/pipodesk/ticket/CopyButton'

describe('CopyButton', () => {
  it('should put the value on the clipboard and announce Copiado in a live region', async () => {
    const user = userEvent.setup()
    render(<CopyButton value="693458" label="Copiar o número do contrato 693458" />)

    const button = screen.getByRole('button', { name: 'Copiar o número do contrato 693458' })
    const status = within(button).getByRole('status')
    expect(status).toBeEmptyDOMElement()
    expect(button).not.toHaveAttribute('data-copied')

    await user.click(button)

    await expect(navigator.clipboard.readText()).resolves.toBe('693458')
    expect(status).toHaveTextContent('Copiado')
    expect(button).toHaveAttribute('data-copied', 'true')
  })

  /** Both glyphs stay mounted and `data-copied` picks which one shows: the
   *  swap is a CSS crossfade, and jsdom computes no stylesheet. */
  it('should keep the copy and check glyphs mounted, so the swap can be a crossfade', () => {
    render(<CopyButton value="x" label="Copiar" />)
    const button = screen.getByRole('button', { name: 'Copiar' })

    expect(button.querySelector('[data-glyph="copy"]')).toBeInTheDocument()
    expect(button.querySelector('[data-glyph="check"]')).toBeInTheDocument()
  })

  it('should mark itself for the parent that reveals it on hover', () => {
    render(<CopyButton value="x" label="Copiar" className="extra" />)
    const button = screen.getByRole('button', { name: 'Copiar' })

    expect(button).toHaveAttribute('data-copy-button')
    expect(button).toHaveClass('extra')
  })
})

describe('CopyButton timing', () => {
  /** The page's inline button re-armed its timer on every copy; the shared
   *  component must not lose that on the way. */
  it('should keep saying Copiado for the full window after a second click', async () => {
    vi.useFakeTimers()
    // fireEvent, not userEvent: its pointer delays and the fake clock deadlock.
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
    try {
      render(<CopyButton value="x" label="Copiar" />)
      const button = screen.getByRole('button', { name: 'Copiar' })
      const tick = (ms: number) => act(async () => void vi.advanceTimersByTime(ms))

      await act(async () => void fireEvent.click(button))
      await tick(1000)
      await act(async () => void fireEvent.click(button))
      await tick(1000)

      expect(button).toHaveAttribute('data-copied', 'true')

      await tick(500)

      expect(button).not.toHaveAttribute('data-copied')
    } finally {
      vi.useRealTimers()
    }
  })
})
