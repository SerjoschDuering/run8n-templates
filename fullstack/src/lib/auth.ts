import { GoTrueClient } from '@supabase/gotrue-js'

export const auth = new GoTrueClient({
  url: import.meta.env.VITE_GOTRUE_URL,
  autoRefreshToken: true,
  persistSession: true,
})

export async function getAccessToken(): Promise<string | null> {
  const { data } = await auth.getSession()
  return data.session?.access_token ?? null
}

export async function getCurrentUser() {
  const { data } = await auth.getUser()
  return data.user
}

export async function signOut() {
  await auth.signOut()
}
