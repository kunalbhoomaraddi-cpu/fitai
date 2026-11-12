import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setUnauthorizedHandler, tokenStore } from '../services/api'
import { authApi, profileApi, type OtpChallenge, type Verification } from '../services/fitai'
import type { Profile, Units, User } from '../types'

interface AuthState {
  user: User | null; profile: Profile | null; loading: boolean; units: Units
  login: (email: string, password: string) => Promise<{ user?: User; otp?: OtpChallenge }>
  completeLogin: (otpToken: string, code: string) => Promise<User>
  register: (name: string, email: string, password: string) => Promise<User>
  startDemo: () => Promise<User>
  logout: () => void
  refresh: () => Promise<void>
  setProfile: (p: Profile | null) => void
  setUser: (u: User) => void
  lastVerification: Verification | null
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastVerification, setLastVerification] = useState<Verification | null>(null)

  const logout = useCallback(() => {
    if (tokenStore.get()) authApi.logout().catch(() => undefined)
    tokenStore.clear(); setUser(null); setProfile(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setLoading(false); return }
    try {
      const u = await authApi.me()
      setUser(u)
      setProfile(u.onboarding_complete && u.email_verified ? await profileApi.get() : null)
    } catch { tokenStore.clear(); setUser(null) } finally { setLoading(false) }
  }, [])

  useEffect(() => { setUnauthorizedHandler(() => { tokenStore.clear(); setUser(null); setProfile(null) }); refresh() }, [refresh])

  const accept = useCallback(async (t: { access_token: string; user: User; verification?: Verification | null }) => {
    tokenStore.set(t.access_token); setUser(t.user); setLastVerification(t.verification ?? null)
    setProfile(t.user.onboarding_complete && t.user.email_verified ? await profileApi.get() : null)
    return t.user
  }, [])

  const value = useMemo<AuthState>(() => ({
    user, profile, loading, units: profile?.unit_system ?? 'metric',
    login: async (e, p) => {
      const r = await authApi.login(e, p)
      if ('otp_required' in r) return { otp: r }
      return { user: await accept(r) }
    },
    completeLogin: async (t, c) => accept(await authApi.loginVerify(t, c)),
    register: async (n, e, p) => accept(await authApi.register(n, e, p)),
    startDemo: async () => accept(await authApi.demo()),
    logout, refresh, setProfile, setUser, lastVerification,
  }), [user, profile, loading, accept, logout, refresh, lastVerification])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = () => { const c = useContext(Ctx); if (!c) throw new Error('useAuth outside provider'); return c }
