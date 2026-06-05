import type { RuntimeConfig } from '@/types'

/**
 * 渲染层会话状态的单一真源：serverURL + token 都放内存，token 同步落盘到
 * 主进程 safeStorage、serverURL 落盘到 electron-store。http/urls 直接读这里。
 */
let _serverURL = 'http://localhost:9277'
let _token = ''
let _quality = '128k'
let _onUnauthorized: (() => void) | null = null

export function serverURL(): string {
  return _serverURL
}

export function token(): string {
  return _token
}

export function quality(): string {
  return _quality
}

export async function setServerURL(url: string): Promise<void> {
  const clean = url.replace(/\/+$/, '')
  _serverURL = clean
  await window.pf.config.set({ serverURL: clean })
}

export function setQualityLocal(q: string): void {
  _quality = q
}

export async function setToken(t: string): Promise<void> {
  _token = t || ''
  await window.pf.secrets.setToken(_token)
}

export async function clearToken(): Promise<void> {
  _token = ''
  await window.pf.secrets.clearToken()
}

export function setUnauthorizedHandler(fn: () => void): void {
  _onUnauthorized = fn
}

export function fireUnauthorized(): void {
  if (_onUnauthorized) _onUnauthorized()
}

/** 启动时从主进程读取已保存的 serverURL / quality / token。 */
export async function bootstrap(): Promise<RuntimeConfig> {
  const cfg = (await window.pf.config.getAll()) as RuntimeConfig
  if (cfg?.serverURL) _serverURL = cfg.serverURL
  if (cfg?.quality) _quality = cfg.quality
  _token = (await window.pf.secrets.getToken()) || ''
  return cfg
}
