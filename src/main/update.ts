import { app, ipcMain, shell } from 'electron'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createWriteStream } from 'node:fs'
import { mkdtemp, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getConfig, setConfig } from './ipc/config'
import { getMainWindow } from './windows/mainWindow'

const execFileP = promisify(execFile)

/**
 * 未签名 macOS 应用的「全自动更新」：检测 → 下载 .app 的 zip（带进度）→ 解压 →
 * 剥隔离标记 → 后台脚本替换旧 .app → 重启新版本。失败自动兜底成手动下载 dmg。
 * 数据源：GitHub Releases latest（可用 env PF_UPDATE_FEED 覆盖，测试/自托管）。
 */
// GitHub 仓库（owner/repo）：自动更新从这里的 Releases latest 拉取；仓库 public、资产含 .dmg + .app 的 zip
const GITHUB_REPO = 'Lens-lzy/private-fm-desktop'

function feedURL(): string {
  return process.env.PF_UPDATE_FEED || `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
}

export interface UpdateInfo {
  current: string
  latest: string
  notes: string
  zipUrl: string // 自动更新用（.app 的 zip，匹配当前架构）
  dmgUrl: string // 手动兜底
  hasUpdate: boolean
}

function parseVer(v: string): { core: number[]; pre: string } {
  const [core, pre = ''] = v.replace(/^v/, '').trim().split('-')
  return { core: core.split('.').map((n) => parseInt(n, 10) || 0), pre }
}

/** 语义化版本比较：>0 表示 a 比 b 新。正式版 > 预发布（1.0.0 > 1.0.0-beta.1）。 */
export function cmpVer(a: string, b: string): number {
  const pa = parseVer(a)
  const pb = parseVer(b)
  for (let i = 0; i < 3; i++) {
    const d = (pa.core[i] || 0) - (pb.core[i] || 0)
    if (d !== 0) return d > 0 ? 1 : -1
  }
  if (pa.pre === pb.pre) return 0
  if (!pa.pre) return 1
  if (!pb.pre) return -1
  return pa.pre > pb.pre ? 1 : -1
}

interface Asset {
  name?: string
  browser_download_url?: string
}
/** 按当前 CPU 架构挑资产（arm64 / x64），挑不到就退而取第一个同类型资产。 */
function pickAsset(assets: Asset[], ext: string): string {
  const re = new RegExp('\\.' + ext + '$', 'i')
  const list = assets.filter((a) => re.test(a.name || ''))
  const archRe = process.arch === 'arm64' ? /arm64/i : /(x64|x86_64|intel)/i
  const byArch = list.find((a) => archRe.test(a.name || ''))
  return (byArch || list[0])?.browser_download_url || ''
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(feedURL(), {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'PrivateFM-Updater' }
    })
    if (!res.ok) return null
    const j = (await res.json()) as Record<string, unknown>
    const latest = String((j.tag_name as string) || (j.version as string) || '').replace(/^v/, '')
    if (!latest) return null
    const notes = String((j.body as string) || (j.notes as string) || '')
    const assets = Array.isArray(j.assets) ? (j.assets as Asset[]) : []
    const zipUrl = pickAsset(assets, 'zip') || String((j.zipUrl as string) || '')
    const dmgUrl =
      pickAsset(assets, 'dmg') || String((j.dmgUrl as string) || (j.html_url as string) || '')
    const current = app.getVersion()
    return { current, latest, notes, zipUrl, dmgUrl, hasUpdate: cmpVer(latest, current) > 0 }
  } catch {
    return null
  }
}

function sendMain(channel: string, payload?: unknown): void {
  const w = getMainWindow()
  if (w && !w.isDestroyed()) w.webContents.send(channel, payload)
}

/** 从 execPath 推出当前 .app 包路径（dev 下是 Electron.app，故仅 packaged 时用于替换）。 */
function currentAppBundle(): string | null {
  const exe = process.execPath
  const i = exe.indexOf('.app/')
  return i === -1 ? null : exe.slice(0, i + 4)
}

async function downloadZip(url: string, dest: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error('下载失败（HTTP ' + res.status + '）')
  const total = Number(res.headers.get('content-length')) || 0
  const file = createWriteStream(dest)
  const reader = (res.body as ReadableStream<Uint8Array>).getReader()
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    file.write(Buffer.from(value))
    received += value.byteLength
    sendMain('pf:update:progress', {
      percent: total ? Math.round((received / total) * 100) : 0,
      received,
      total
    })
  }
  await new Promise<void>((resolve, reject) =>
    file.end((err?: Error | null) => (err ? reject(err) : resolve()))
  )
}

// 后台替换脚本：等本进程退出 → 备份旧包 → 拷新包 → 重开；失败则回滚。
const SWAP_SCRIPT = `#!/bin/bash
PID="$1"; NEW="$2"; TARGET="$3"
for i in $(seq 1 150); do kill -0 "$PID" 2>/dev/null || break; sleep 0.2; done
sleep 0.4
BAK="\${TARGET}.old-$$"
if mv "$TARGET" "$BAK" 2>/dev/null; then
  if ditto "$NEW" "$TARGET" 2>/dev/null; then
    xattr -dr com.apple.quarantine "$TARGET" 2>/dev/null || true
    rm -rf "$BAK" 2>/dev/null || true
    open "$TARGET"
  else
    rm -rf "$TARGET" 2>/dev/null || true
    mv "$BAK" "$TARGET" 2>/dev/null || true
    open "$TARGET"
  fi
else
  ditto "$NEW" "$TARGET" 2>/dev/null && xattr -dr com.apple.quarantine "$TARGET" 2>/dev/null
  open "$TARGET"
fi
`

/** 下载并安装更新；进度/错误通过 IPC 回报渲染层。成功后会自动退出并由脚本重启。 */
export async function downloadAndInstall(): Promise<void> {
  const info = await checkForUpdate()
  if (!info || !info.hasUpdate) {
    sendMain('pf:update:error', { message: '当前已是最新版本' })
    return
  }
  if (!info.zipUrl) {
    sendMain('pf:update:error', { message: '该版本没有可自动安装的更新包', dmgUrl: info.dmgUrl })
    return
  }
  try {
    sendMain('pf:update:progress', { percent: 0 })
    const dir = await mkdtemp(join(tmpdir(), 'pf-upd-'))
    const zip = join(dir, 'update.zip')
    await downloadZip(info.zipUrl, zip)
    sendMain('pf:update:progress', { percent: 100, phase: 'extracting' })
    const extract = join(dir, 'app')
    await execFileP('ditto', ['-x', '-k', zip, extract])
    const appName = (await readdir(extract)).find((e) => e.endsWith('.app'))
    if (!appName) throw new Error('解压后未找到 .app')
    const newApp = join(extract, appName)
    await execFileP('xattr', ['-dr', 'com.apple.quarantine', newApp]).catch(() => {})
    const target = currentAppBundle()
    if (!app.isPackaged || !target) {
      // 开发模式不真正替换（execPath 指向 Electron.app）
      sendMain('pf:update:ready-dev', { newApp, target })
      return
    }
    const script = join(dir, 'swap.sh')
    await writeFile(script, SWAP_SCRIPT, { mode: 0o755 })
    spawn('/bin/bash', [script, String(process.pid), newApp, target], {
      detached: true,
      stdio: 'ignore'
    }).unref()
    setTimeout(() => app.quit(), 300)
  } catch (e) {
    sendMain('pf:update:error', { message: (e as Error).message || '更新失败', dmgUrl: info.dmgUrl })
  }
}

/** 启动后静默检查；有新版且未「跳过」→ 通知渲染层弹更新框。 */
export async function checkOnLaunch(): Promise<void> {
  const info = await checkForUpdate()
  if (!info || !info.hasUpdate) return
  if (getConfig().skippedVersion === info.latest) return
  sendMain('pf:update:available', info)
}

export function registerUpdateIpc(): void {
  ipcMain.handle('pf:app:version', () => app.getVersion())
  ipcMain.handle('pf:updates:check', () => checkForUpdate())
  ipcMain.handle('pf:updates:download', () => downloadAndInstall())
  ipcMain.handle('pf:updates:skip', (_e, v: string) => {
    setConfig({ skippedVersion: String(v) })
    return true
  })
  ipcMain.handle('pf:updates:open-manual', (_e, url: string) => {
    if (url) void shell.openExternal(url)
  })
}
