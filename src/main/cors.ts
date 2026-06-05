import { session } from 'electron'

/**
 * 后端 (web-music-dist) 没有 CORS 中间件，渲染层在 dev (http://localhost:5173)
 * 与 prod (file://) 下都属于跨域，浏览器会拦截 fetch。这里在主进程统一给
 * 所有响应注入 CORS 头（含 Express 自动应答的 OPTIONS 预检 200），从而放行。
 *
 * 我们用 `Authorization: Bearer` 头而非 cookie，请求不带 credentials，
 * 因此 `Access-Control-Allow-Origin: *` 合法且足够。不修改后端。
 */
export function installCorsBypass(): void {
  const ses = session.defaultSession

  // 预检请求带 Access-Control-Request-Headers 时，回显允许的头。
  ses.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders ?? {}

    // 删除可能已存在的同名头（大小写不敏感），避免重复。
    for (const key of Object.keys(headers)) {
      const lower = key.toLowerCase()
      if (
        lower === 'access-control-allow-origin' ||
        lower === 'access-control-allow-methods' ||
        lower === 'access-control-allow-headers' ||
        lower === 'access-control-allow-credentials'
      ) {
        delete headers[key]
      }
    }

    headers['Access-Control-Allow-Origin'] = ['*']
    headers['Access-Control-Allow-Methods'] = ['GET, POST, PUT, DELETE, OPTIONS']
    headers['Access-Control-Allow-Headers'] = ['Authorization, Content-Type, Range']

    callback({ responseHeaders: headers })
  })
}
