import { describe, expect, it } from 'vitest'
import { scrubCrumb, scrubEvent } from './monitoring'

describe('error reports', () => {
  it('drop the user, headers and query strings', () => {
    const e = scrubEvent({ request: { url: 'https://app/nutrition?q=paneer#x', headers: { a: 'b' }, cookies: 'c', data: 'd' }, user: { email: 'me@x.com' } })
    expect(e).toEqual({ request: { url: 'https://app/nutrition' } })
  })

  it('keep only page changes and API calls, without queries', () => {
    expect(scrubCrumb({ category: 'console', message: 'secret' })).toBeNull()
    expect(scrubCrumb({ category: 'ui.click', message: 'input#email' })).toBeNull()
    expect(scrubCrumb({ category: 'fetch', data: { method: 'GET', url: '/api/nutrition/search?q=dal', status_code: 200, body: 'x' } }))
      .toEqual({ category: 'fetch', data: { method: 'GET', url: '/api/nutrition/search', status_code: 200 } })
  })
})
