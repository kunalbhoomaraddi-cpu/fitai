import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DescribeMeal } from './DescribeMeal'

const describeMeal = vi.fn()
const add = vi.fn()
vi.mock('../../context/ToastContext', () => ({ useToast: () => vi.fn() }))
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { coach_language: 'en' } }) }))
vi.mock('../../services/fitai', () => ({ nutritionApi: { describe: (t: string) => describeMeal(t), add: (b: unknown) => add(b) } }))

const item = (name: string, grams: number, calories: number) => ({
  name, seen_as: name, grams, portion: null, per_100g: { calories: calories / grams * 100, protein_g: 10, carbs_g: 50, fat_g: 5 },
  calories, protein_g: 8, carbs_g: 40, fat_g: 4, basis: 'database' as const, source_id: 'in:x', servings: [], confidence: 0.8,
})

describe('say what you ate', () => {
  beforeEach(() => { describeMeal.mockReset(); add.mockReset(); add.mockResolvedValue({}) })

  it('turns typed words into foods and logs them tagged as voice', async () => {
    describeMeal.mockResolvedValue({ text: 'two rotis and dal', items: [item('Roti', 80, 211), item('Dal', 150, 172)],
      totals: { calories: 383, protein_g: 16, carbs_g: 80, fat_g: 8 }, source: 'rules', notice: null, not_found: [] })
    const done = vi.fn()
    render(<DescribeMeal open onClose={() => undefined} date="2026-11-27" onAdded={done} />)
    await userEvent.type(screen.getByLabelText('What you ate'), 'two rotis and dal')
    await userEvent.click(screen.getByRole('button', { name: /find foods/i }))
    expect(describeMeal).toHaveBeenCalledWith('two rotis and dal')
    expect(await screen.findByText('Roti')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: 'Include Dal' }))      // untick one
    await userEvent.click(screen.getByRole('button', { name: /Add 1 item/ }))
    expect(add).toHaveBeenCalledTimes(1)
    expect(add.mock.calls[0][0]).toMatchObject({ name: 'Roti', quantity_g: 80, calories: 211, source: 'voice', eaten_on: '2026-11-27' })
    expect(done).toHaveBeenCalled()
  })

  it('says which foods it could not find', async () => {
    describeMeal.mockResolvedValue({ text: 'green tea', items: [], totals: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
      source: 'rules', notice: null, not_found: ['green tea'] })
    render(<DescribeMeal open onClose={() => undefined} date="2026-11-27" onAdded={() => undefined} />)
    await userEvent.type(screen.getByLabelText('What you ate'), 'green tea')
    await userEvent.click(screen.getByRole('button', { name: /find foods/i }))
    expect(await screen.findByText(/Not in the food database: green tea/)).toBeInTheDocument()
  })

  it('offers typing when the browser cannot listen', () => {
    render(<DescribeMeal open onClose={() => undefined} date="2026-11-27" onAdded={() => undefined} />)
    expect(screen.getByText(/This browser can't listen/)).toBeInTheDocument()   // jsdom has no speech recognition
    expect(screen.queryByRole('button', { name: /tap and speak/i })).not.toBeInTheDocument()
  })
})
