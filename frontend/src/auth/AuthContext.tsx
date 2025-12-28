import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react'
import { AuthResponse, AuthUser, getCurrentUser, login as apiLogin, register as apiRegister } from '../api/auth'
import { clearAuthToken } from '../api/client'
import { UserSettingsRequest, updateUserSettings } from '../api/settings'

export type AuthState = {
  isAuthenticated: boolean
  token: string | null
  user: AuthUser | null
}

export type AuthContextType = AuthState & {
  initializing: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
  updateSettings: (payload: UserSettingsRequest) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const emptyState: AuthState = {
  isAuthenticated: false,
  token: null,
  user: null
}

function applyAuthResponse(response: AuthResponse): AuthState {
  return {
    isAuthenticated: true,
    token: response.token,
    user: response.user ?? null
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>(emptyState)
  const [initializing, setInitializing] = useState<boolean>(true)

  const resetAuth = () => {
    clearAuthToken()
    setState(emptyState)
  }

  const setUser = (user: AuthUser | null) => {
    setState((prev) => ({ ...prev, isAuthenticated: !!user, token: localStorage.getItem('token'), user }))
  }

  const refreshUser = async () => {
    try {
      const user = await getCurrentUser()
      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        token: localStorage.getItem('token'),
        user
      }))
    } catch (e) {
      resetAuth()
      throw e
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setInitializing(false)
      return
    }

    setState({ isAuthenticated: true, token, user: null })
    refreshUser().catch(() => {}).finally(() => setInitializing(false))
  }, [])

  const login = async (email: string, password: string) => {
    const response = await apiLogin(email, password)
    setState(applyAuthResponse(response))
    if (!response.user) {
      await refreshUser()
    }
  }

  const register = async (email: string, password: string) => {
    const response = await apiRegister(email, password)
    setState(applyAuthResponse(response))
    if (!response.user) {
      await refreshUser()
    }
  }

  const updateSettings = async (payload: UserSettingsRequest) => {
    const updated = await updateUserSettings(payload)
    setUser(updated)
  }

  const logout = () => {
    resetAuth()
  }

  const value = useMemo<AuthContextType>(() => ({
    ...state,
    initializing,
    login,
    register,
    logout,
    refreshUser,
    updateSettings
  }), [state, initializing, login, register, logout, refreshUser, updateSettings])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
