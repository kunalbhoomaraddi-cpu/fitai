import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConsentGate from './ConsentGate'
import type { User } from '../types'

const auth = { user: null as Partial<User> | null, setUser: vi.fn(), logout: vi.fn() }
const consent = vi.fn()
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../services/fitai', () => ({ authApi: { consent: () => consent() } }))

const show = () => render(<MemoryRouter><ConsentGate /></MemoryRouter>)

describe('one-time consent for older accounts', () => {
  beforeEach(() => { auth.setUser.mockReset(); auth.logout.mockReset(); consent.mockReset() })

  it('stays hidden for people who already agreed', () => {
    auth.user = { id: 1, needs_consent: false }
    show()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('needs the box ticked, then records consent', async () => {
    auth.user = { id: 1, needs_consent: true }
    consent.mockResolvedValue({ id: 1, needs_consent: false })
    show()
    const go = screen.getByRole('button', { name: 'Continue' })
    expect(go).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(go)
    expect(consent).toHaveBeenCalledOnce()
    expect(auth.setUser).toHaveBeenCalledWith({ id: 1, needs_consent: false })
  })

  it('offers signing out instead', async () => {
    auth.user = { id: 1, needs_consent: true }
    show()
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(auth.logout).toHaveBeenCalled()
  })
})
