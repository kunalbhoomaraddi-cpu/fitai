import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SwapExercise } from './SwapExercise'

vi.mock('../../services/fitai', () => ({
  workoutApi: {
    alternatives: () => Promise.resolve([
      { exercise_id: 'goblet_squat', name: 'Goblet Squat', muscle: 'quads', equipment: ['dumbbells', 'kettlebell'], type: 'compound', same_muscle: true },
      { exercise_id: 'burpee', name: 'Burpee', muscle: 'cardio', equipment: ['bodyweight'], type: 'conditioning', same_muscle: false },
    ]),
  },
}))

describe('swap exercise', () => {
  it('lists alternatives and swaps the one picked', async () => {
    const onSwap = vi.fn().mockResolvedValue(undefined)
    render(<SwapExercise open sessionId={1} index={0} name="Barbell Back Squat" onClose={() => undefined} onSwap={onSwap} />)
    expect(screen.getByText('Swap Barbell Back Squat')).toBeInTheDocument()
    expect(await screen.findByText('Goblet Squat')).toBeInTheDocument()
    expect(screen.getByText(/Also works this muscle/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Goblet Squat/ }))
    expect(onSwap).toHaveBeenCalledWith('goblet_squat')
  })
})
