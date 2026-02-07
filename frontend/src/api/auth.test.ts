import { describe, expect, it, beforeEach, vi } from 'vitest'
import { login, register } from './auth'

const fetchMock = vi.fn()

global.fetch = fetchMock

global.localStorage = {
  store: {} as Record<string, string>,
  getItem(key: string) { return this.store[key] },
  setItem(key: string, value: string) { this.store[key] = value },
  removeItem(key: string) { delete this.store[key] },
  clear() { this.store = {} }
} as unknown as Storage

describe('auth api', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    ;(global.localStorage as any).clear()
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'abc', user: { id: '1', email: 'test@example.com' } })
    })
  })

  it('register calls correct endpoint without setting auth token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true, requiresEmailVerification: true })
    })

    await register({
      email: 'user@example.com',
      password: 'Password1!',
      termsAccepted: true,
      termsVersion: '2024-09-01',
      privacyAccepted: true,
      privacyVersion: '2024-09-01',
      captchaToken: 'token',
      locale: 'en-GB'
    })
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/auth/register', expect.anything())
    expect(localStorage.getItem('token')).toBeUndefined()
  })

  it('login calls correct endpoint and stores token', async () => {
    await login('user@example.com', 'Password1!')
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8080/api/auth/login', expect.anything())
    expect(localStorage.getItem('token')).toBe('abc')
  })
})
