import { serverURL, token, fireUnauthorized } from './session'

/**
 * 薄 HTTP 封装（移植自 public/app.js 的 api.get/post/put/del）：
 * - URL 前缀 serverURL；注入 Authorization: Bearer
 * - 401 集中处理：触发登出回调并抛错
 * - 非 2xx：抛出后端返回的 error 文案
 */
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function authHeaders(): Record<string, string> {
  const t = token()
  return t ? { Authorization: 'Bearer ' + t } : {}
}

async function handle(res: Response): Promise<unknown> {
  if (res.status === 401) {
    fireUnauthorized()
    throw new ApiError('未登录', 401)
  }
  if (!res.ok) {
    let msg = res.statusText
    try {
      const data = (await res.json()) as { error?: string }
      if (data?.error) msg = data.error
    } catch {
      /* 非 JSON 错误体 */
    }
    throw new ApiError(msg, res.status)
  }
  return res.json()
}

function url(path: string): string {
  return path.startsWith('http') ? path : serverURL() + path
}

export const http = {
  async get<T = unknown>(path: string): Promise<T> {
    const res = await fetch(url(path), { headers: authHeaders() })
    return (await handle(res)) as T
  },
  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(url(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body ?? {})
    })
    return (await handle(res)) as T
  },
  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(url(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body ?? {})
    })
    return (await handle(res)) as T
  },
  async del<T = unknown>(path: string): Promise<T> {
    const res = await fetch(url(path), { method: 'DELETE', headers: authHeaders() })
    return (await handle(res)) as T
  }
}

/**
 * 登录 / 注册不带 token，且失败不应触发全局登出，单独走裸 fetch。
 */
export async function rawPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(url(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  })
  if (!res.ok) {
    let msg = res.statusText
    try {
      const data = (await res.json()) as { error?: string }
      if (data?.error) msg = data.error
    } catch {
      /* ignore */
    }
    throw new ApiError(msg, res.status)
  }
  return (await res.json()) as T
}
