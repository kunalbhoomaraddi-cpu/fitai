import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BreakCard, WaterCard, WeighInCard } from './QuickLog'

const toast = vi.fn()
const addWater = vi.fn()
const addWeight = vi.fn()
const endBreak = vi.fn()
vi.mock('../../context/ToastContext', () => ({ useToast: () => toast }))
vi.mock('../../services/fitai', () => ({
  nutritionApi: { addWater: (ml: number) => addWater(ml) },
  progressApi: { addWeight: (b: unknown) => addWeight(b) },
  profileApi: { endBreak: (id: number) => endBreak(id), breaks: () => Promise.resolve({ active: null, upcoming: [] }), addBreak: vi.fn() },
}))

const day = { date: '2026-11-26', ml: 500, goal_ml: 2500, glasses: 2, goal_glasses: 10 }

describe('water card', () => {
  beforeEach(() => { toast.mockReset(); addWater.mockReset() })

  it('adds a glass and shows the saved total', async () => {
    addWater.mockResolvedValue({ ...day, ml: 750, glasses: 3 })
    render(<WaterCard initial={day} />)
    await userEvent.click(screen.getByRole('button', { name: /Glass \(250 ml\)/ }))
    expect(addWater).toHaveBeenCalledWith(250)
    expect(await screen.findByText('0.75')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: '3 of 10 glasses' })).toBeInTheDocument()
  })

  it('puts the number back if saving fails', async () => {
    addWater.mockRejectedValue(new Error('offline'))
    render(<WaterCard initial={day} />)
    await userEvent.click(screen.getByRole('button', { name: /Glass \(250 ml\)/ }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith('error', 'Water not saved', 'offline'))
    expect(screen.getByText('0.5')).toBeInTheDocument()
  })

  it("can't remove a glass at zero", () => {
    render(<WaterCard initial={{ ...day, ml: 0, glasses: 0 }} />)
    expect(screen.getByRole('button', { name: 'Remove a glass' })).toBeDisabled()
  })
})

describe('weigh-in card', () => {
  beforeEach(() => { addWeight.mockReset(); addWeight.mockResolvedValue({}); toast.mockReset() })

  it('saves pounds as kilograms', async () => {
    const saved = vi.fn()
    render(<WeighInCard units="imperial" lastKg={70} lastDate="2026-11-20" onSaved={saved} />)
    await userEvent.type(screen.getByLabelText("Today's weight"), '154.5')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(addWeight.mock.calls[0][0].weight_kg).toBeCloseTo(70.08, 2)
    expect(saved).toHaveBeenCalled()
  })

  it('refuses an impossible number', async () => {
    render(<WeighInCard units="metric" lastKg={null} lastDate={null} onSaved={() => undefined} />)
    await userEvent.type(screen.getByLabelText("Today's weight"), '7')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(addWeight).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('error', 'Check the number', 'Enter your weight in kg.')
  })
})

describe('break card', () => {
  it('shows an active break and ends it', async () => {
    endBreak.mockResolvedValue({})
    const changed = vi.fn()
    render(<BreakCard active={{ id: 4, kind: 'festival', label: 'Festival', start_on: '2026-11-25', end_on: '2026-11-28', note: 'Deepavali', active: true, days_left: 3 }} onChanged={changed} />)
    expect(screen.getByText('Festival break')).toBeInTheDocument()
    expect(screen.getByText(/Deepavali, until/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'End break now' }))
    expect(endBreak).toHaveBeenCalledWith(4)
    await waitFor(() => expect(changed).toHaveBeenCalled())
  })
})
