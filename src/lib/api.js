export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:5000'
).replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = 4000

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request(path, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })
    const payload = await response.json().catch(() => ({}))
    return { ok: response.ok, status: response.status, data: payload }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The Flask API did not respond before the request timed out.')
    }
    if (error instanceof TypeError) {
      throw new Error('Could not reach the Flask API. Start the backend or check VITE_API_BASE_URL.')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export function getHealth() {
  return request('/api/health')
}

export function getModelInfo() {
  return request('/api/model/info')
}

export function getModelExploration() {
  return request('/api/model/exploration')
}

export function getExplanationStatus() {
  return request('/api/explain/status')
}

export async function predictAssessment(features) {
  const response = await request('/api/predict', {
    method: 'POST',
    body: JSON.stringify(features),
  })
  if (!response.ok) {
    throw new ApiError(
      response.data.message || 'The backend could not process this assessment.',
      response.status,
      response.data.error,
    )
  }
  return response.data
}

export async function explainAssessment(features) {
  const response = await request('/api/explain', {
    method: 'POST',
    body: JSON.stringify(features),
  })
  if (!response.ok) {
    throw new ApiError(
      response.data.message || 'An individual explanation is not available.',
      response.status,
      response.data.error,
    )
  }
  return response.data
}