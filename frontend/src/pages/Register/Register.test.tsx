import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Register from './Register'

const register = vi.fn()
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ register }) }))

async function fillForm() {
  await userEvent.type(screen.getByLabelText('Full name'), 'Neha K')
  await userEvent.type(screen.getByLabelText('Email'), 'neha@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'secret123')
}

describe('sign-up consent', () => {
  beforeEach(() => { register.mockReset(); register.mockResolvedValue({ email_verified: false }) })

  it('asks people to accept the terms before creating the account', async () => {
    render(<MemoryRouter><Register /></MemoryRouter>)
    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(screen.getByText(/tick the box/i)).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('creates the account once the box is ticked, and links both documents', async () => {
    render(<MemoryRouter><Register /></MemoryRouter>)
    const consent = within(screen.getByRole('checkbox').closest('label')!)
    expect(consent.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
    expect(consent.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
    await fillForm()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(register).toHaveBeenCalledWith('Neha K', 'neha@example.com', 'secret123')
  })
})
