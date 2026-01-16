import { auth, getCurrentUser } from '@/lib/auth'
import type { User } from '@supabase/gotrue-js'

export interface AuthSlice {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const authSlice = (set: any, get: any): AuthSlice => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    const { data, error } = await auth.signInWithPassword({ email, password })
    if (error) throw error
    set({ user: data.user, isAuthenticated: true })
  },

  signup: async (email: string, password: string) => {
    const { data, error } = await auth.signUp({ email, password })
    if (error) throw error
    set({ user: data.user, isAuthenticated: true })
  },

  logout: async () => {
    await auth.signOut()
    set({ user: null, isAuthenticated: false })
  },

  checkAuth: async () => {
    try {
      const user = await getCurrentUser()
      set({ user, isAuthenticated: !!user, isLoading: false })
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },
})
