import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NumCell } from './NumCell'

function Harness({ onValue }: { onValue: (v: number | null) => void }) {
  const [v, setV] = useState<number | null>(null)
  return <NumCell value={v} onValue={n => { setV(n); onValue(n) }} label="Weight" placeholder="kg" decimal />
}

describe('NumCell', () => {
  it('lets people type a decimal one key at a time', async () => {
    const seen = vi.fn()
    render(<Harness onValue={seen} />)
    const box = screen.getByLabelText('Weight')
    await userEvent.type(box, '42.5')
    expect(box).toHaveValue('42.5')
    expect(seen).toHaveBeenLastCalledWith(42.5)
  })

  it('ignores letters and accepts a comma', async () => {
    render(<Harness onValue={() => undefined} />)
    const box = screen.getByLabelText('Weight')
    await userEvent.type(box, '7a,5')
    expect(box).toHaveValue('7,5')
  })
})
