import { useStore } from '@/store'
import { callWindmill } from '@/lib/api'
import { useState, useEffect } from 'react'

export default function Dashboard() {
  const { user, logout } = useStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    await logout()
  }

  // Example: Call a Windmill script
  const fetchData = async () => {
    setLoading(true)
    try {
      // Replace with your actual Windmill script path
      const result = await callWindmill('myapp/example/get_data', {})
      setData(result)
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Welcome, {user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">
              Quick Start
            </h2>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-blue-900">
                  1. Create Windmill scripts
                </h3>
                <p className="mt-1 text-sm text-blue-700">
                  Add your backend scripts in <code className="bg-blue-100 px-1 rounded">windmill/f/myapp/</code>
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-blue-900">
                  2. Call scripts from React
                </h3>
                <p className="mt-1 text-sm text-blue-700">
                  Use <code className="bg-blue-100 px-1 rounded">callWindmill()</code> in components or Zustand actions
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-blue-900">
                  3. Push to production
                </h3>
                <p className="mt-1 text-sm text-blue-700">
                  Run <code className="bg-blue-100 px-1 rounded">npm run deploy</code>
                </p>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={fetchData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Test API Call'}
              </button>
              {data && (
                <pre className="mt-4 bg-gray-50 p-4 rounded-md overflow-auto text-sm">
                  {JSON.stringify(data, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
