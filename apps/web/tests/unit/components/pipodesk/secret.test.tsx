import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Secret } from '@/components/pipodesk/ticket/Secret'
import constants from '@/constants/pipodesk/secret'

describe('Secret', () => {
  it('should hide the value behind a fixed-length mask until the eye reveals it', async () => {
    const user = userEvent.setup()
    render(<Secret value="34q5-EM7J-68!" label="senha do portal" />)

    // Ten dots for any value: the mask must not leak the length. The dots are
    // decoration; what a screen reader gets is the hidden text.
    expect(screen.getByText(constants.mask)).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('senha do portal oculta')).toBeInTheDocument()
    expect(screen.queryByText('34q5-EM7J-68!')).not.toBeInTheDocument()
    const eye = screen.getByRole('button', { name: 'Mostrar a senha do portal' })
    expect(eye).toHaveAttribute('aria-pressed', 'false')

    await user.click(eye)

    expect(screen.getByText('34q5-EM7J-68!')).toBeInTheDocument()
    expect(screen.queryByText('senha do portal oculta')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ocultar a senha do portal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Ocultar a senha do portal' }))

    expect(screen.queryByText('34q5-EM7J-68!')).not.toBeInTheDocument()
  })
})
