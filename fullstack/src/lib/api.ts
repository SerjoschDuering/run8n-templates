import { getAccessToken } from './auth'

const WINDMILL_URL = import.meta.env.VITE_WINDMILL_URL
const WORKSPACE = import.meta.env.VITE_WINDMILL_WORKSPACE

/**
 * Call a Windmill script as an API endpoint
 *
 * @example
 * const user = await callWindmill('myapp/users/get_user', { userId: '123' })
 */
export async function callWindmill<T>(
  scriptPath: string,
  params: Record<string, any> = {}
): Promise<T> {
  const token = await getAccessToken()

  const url = `${WINDMILL_URL}/api/w/${WORKSPACE}/jobs/run_wait_result/f/${scriptPath}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API error: ${error}`)
  }

  return response.json()
}
