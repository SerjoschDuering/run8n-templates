/**
 * Main App Component
 *
 * Template Status: Outline - not fully tested
 *
 * This is the entry point for your React app. It handles:
 * - Authentication state via Zustand store
 * - Conditional rendering (LoginForm vs Dashboard)
 *
 * See CLAUDE.md for full documentation on:
 * - How to call Windmill scripts from React
 * - How to structure Zustand stores
 * - How to integrate GoTrue auth
 */
import { useEffect } from 'react'
import { useStore } from '@/store'
import LoginForm from '@/components/LoginForm'
import Dashboard from '@/components/Dashboard'

function App() {
  const { isAuthenticated, isLoading, checkAuth } = useStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {isAuthenticated ? <Dashboard /> : <LoginForm />}
    </div>
  )
}

export default App
