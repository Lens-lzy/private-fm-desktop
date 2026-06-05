import { app, ipcMain, shell } from 'electron'
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createWriteStream, existsSync } from 'node:fs'
import { mkdtemp, writeFile, readdir, readFile, mkdir, copyFile, rm, stat, open } from 'node:fs/promises'
import { gunzip } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getConfig, setConfig } from './ipc/config'
import { getMainWindow } from './windows/mainWindow'

const execFileP = promisify(execFile)

/**
 * 未签名 macOS 应用的「全自动更新」：检测 → 下载 .app 的 zip（带进度）→ 解压 →
 * 剥隔离标记 → 后台脚本替换旧 .app → 重启新版本。失败自动兜底成手动下载 dmg。
 * 数据源：**自家后端的更新代理** `${serverURL}/api/update/latest`（服务器侧从 GitHub 取包、
 * 经 Cloudflare 转发，绕开国内连不上的 GitHub 下载 CDN）。返回体与 GitHub Release 同构。
 * 可用 env PF_UPDATE_FEED 覆盖；serverURL 为空时回退直连 GitHub。
 */
const GITHUB_REPO = 'Lens-lzy/private-fm-desktop'

function feedURL(): string {
  if (process.env.PF_UPDATE_FEED) return process.env.PF_UPDATE_FEED
  const base = String(getConfig().serverURL || '').replace(/\/+$/, '')
  if (base) return base + '/api/update/latest'
  return `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`
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

// ---- 差量更新（blockmap diff）：只下载变化的字节块，未变部分从本地旧包拷贝 ----
// electron-builder 为 zip 生成同名 .blockmap（gzip 后的 JSON：把文件切成内容定界的块，
// 每块带 size 与 checksum）。新旧 blockmap 按 checksum 比对：相同的块直接从本地旧 zip 拷，
// 不同的块用 HTTP Range 只下这一段，再拼出新 zip。省下绝大部分流量（beta→beta 常只差几 MB）。
const gunzipP = promisify(gunzip)
function updCacheDir(): string {
  return join(app.getPath('userData'), 'pf-updates')
}

interface BlockMap {
  offset: number
  checksums: string[]
  sizes: number[]
}
async function parseBlockMap(buf: Buffer): Promise<BlockMap> {
  const j = JSON.parse((await gunzipP(buf)).toString('utf8')) as {
    files?: { offset?: number; checksums?: string[]; sizes?: number[] }[]
  }
  const f = j.files && j.files[0]
  if (
    !f ||
    !Array.isArray(f.checksums) ||
    !Array.isArray(f.sizes) ||
    f.checksums.length !== f.sizes.length
  ) {
    throw new Error('无效 blockmap')
  }
  return { offset: f.offset || 0, checksums: f.checksums, sizes: f.sizes }
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return Buffer.from(await res.arrayBuffer())
}

type DiffSeg =
  | { type: 'copy'; oldOffset: number; size: number }
  | { type: 'download'; start: number; end: number }

/** 按新旧 blockmap 生成重建计划：哪些段从旧包拷、哪些段需下载（连续待下块合并成一个 Range）。 */
function buildPlan(
  oldMap: BlockMap,
  newMap: BlockMap
): { segs: DiffSeg[]; downloadBytes: number; newSize: number } {
  const oldAt = new Map<string, number>()
  let oo = oldMap.offset
  for (let i = 0; i < oldMap.checksums.length; i++) {
    if (!oldAt.has(oldMap.checksums[i])) oldAt.set(oldMap.checksums[i], oo)
    oo += oldMap.sizes[i]
  }
  const segs: DiffSeg[] = []
  let no = newMap.offset
  let downloadBytes = 0
  for (let i = 0; i < newMap.checksums.length; i++) {
    const size = newMap.sizes[i]
    const from = oldAt.get(newMap.checksums[i])
    const last = segs[segs.length - 1]
    if (from !== undefined) {
      if (last && last.type === 'copy' && last.oldOffset + last.size === from) last.size += size
      else segs.push({ type: 'copy', oldOffset: from, size })
    } else {
      if (last && last.type === 'download' && last.end === no) last.end = no + size
      else segs.push({ type: 'download', start: no, end: no + size })
      downloadBytes += size
    }
    no += size
  }
  return { segs, downloadBytes, newSize: no }
}

/** 执行重建计划：拷贝段从旧 zip 读、下载段用 Range 取，按序写出到 outPath（带进度）。 */
async function executePlan(
  segs: DiffSeg[],
  downloadBytes: number,
  oldZip: string,
  zipUrl: string,
  outPath: string
): Promise<void> {
  const fh = await open(oldZip, 'r')
  const out = createWriteStream(outPath)
  const put = (b: Buffer): Promise<void> =>
    new Promise((res, rej) => out.write(b, (e) => (e ? rej(e) : res())))
  let got = 0
  try {
    for (const seg of segs) {
      if (seg.type === 'copy') {
        let pos = seg.oldOffset
        let left = seg.size
        while (left > 0) {
          const len = Math.min(1 << 20, left)
          const buf = Buffer.allocUnsafe(len)
          const { bytesRead } = await fh.read(buf, 0, len, pos)
          if (bytesRead !== len) throw new Error('旧包读取不足')
          await put(buf)
          pos += len
          left -= len
        }
      } else {
        const res = await fetch(zipUrl, {
          headers: { Range: `bytes=${seg.start}-${seg.end - 1}` }
        })
        if (res.status !== 206 || !res.body) throw new Error('Range 失败 HTTP ' + res.status)
        const reader = (res.body as ReadableStream<Uint8Array>).getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          await put(Buffer.from(value))
          got += value.byteLength
          sendMain('pf:update:progress', {
            percent: downloadBytes ? Math.round((got / downloadBytes) * 100) : 0,
            received: got,
            total: downloadBytes,
            phase: 'diff'
          })
        }
      }
    }
  } finally {
    await fh.close()
    await new Promise<void>((res, rej) => out.end((e?: Error | null) => (e ? rej(e) : res())))
  }
}

/** 尝试差量下载新 zip 到 dest；成功 true，任何不满足/出错 false（调用方退回全量）。 */
async function tryDifferential(info: UpdateInfo, dest: string): Promise<boolean> {
  try {
    const cur = app.getVersion()
    const oldZip = join(updCacheDir(), `${cur}.zip`)
    const oldMapPath = join(updCacheDir(), `${cur}.zip.blockmap`)
    if (!existsSync(oldZip) || !existsSync(oldMapPath)) return false
    const [oldMapBuf, newMapBuf] = await Promise.all([
      readFile(oldMapPath),
      fetchBuffer(info.zipUrl + '.blockmap')
    ])
    const { segs, downloadBytes, newSize } = buildPlan(
      await parseBlockMap(oldMapBuf),
      await parseBlockMap(newMapBuf)
    )
    // 省得不多（仍需下 >80%）就别折腾多段 Range，直接全量更稳更快
    if (downloadBytes > newSize * 0.8) return false
    sendMain('pf:update:progress', { percent: 0, phase: 'diff' })
    await executePlan(segs, downloadBytes, oldZip, info.zipUrl, dest)
    if ((await stat(dest)).size !== newSize) throw new Error('重建大小不符')
    return true
  } catch {
    return false
  }
}

/** ditto 解压 zip → 找出 .app → 剥隔离，返回新 .app 路径。 */
async function extractApp(zip: string, dir: string): Promise<string> {
  sendMain('pf:update:progress', { percent: 100, phase: 'extracting' })
  const extract = join(dir, 'app')
  await rm(extract, { recursive: true, force: true }).catch(() => {})
  await execFileP('ditto', ['-x', '-k', zip, extract])
  const appName = (await readdir(extract)).find((e) => e.endsWith('.app'))
  if (!appName) throw new Error('解压后未找到 .app')
  const newApp = join(extract, appName)
  await execFileP('xattr', ['-dr', 'com.apple.quarantine', newApp]).catch(() => {})
  return newApp
}

/** 取包并解压：先试差量，失败/差量包损坏→退回全量。返回新 .app 路径与所用 zip 路径。 */
async function obtainAndExtract(
  info: UpdateInfo,
  dir: string
): Promise<{ newApp: string; zip: string }> {
  const zip = join(dir, 'update.zip')
  const viaDiff = await tryDifferential(info, zip)
  if (!viaDiff) await downloadZip(info.zipUrl, zip)
  try {
    return { newApp: await extractApp(zip, dir), zip }
  } catch (e) {
    if (!viaDiff) throw e
    // 差量重建出的包无法解压 → 退回全量重下一次
    await downloadZip(info.zipUrl, zip)
    return { newApp: await extractApp(zip, dir), zip }
  }
}

/** 把刚装好的 zip + 其 blockmap 存到 userData，供下次差量比对；只保留最新一份。 */
async function saveArtifactsForNextDiff(zip: string, info: UpdateInfo): Promise<void> {
  const cdir = updCacheDir()
  await mkdir(cdir, { recursive: true })
  for (const f of await readdir(cdir).catch(() => [])) {
    await rm(join(cdir, f), { force: true }).catch(() => {})
  }
  await copyFile(zip, join(cdir, `${info.latest}.zip`))
  const mapBuf = await fetchBuffer(info.zipUrl + '.blockmap')
  await writeFile(join(cdir, `${info.latest}.zip.blockmap`), mapBuf)
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
    const { newApp, zip } = await obtainAndExtract(info, dir)
    const target = currentAppBundle()
    if (!app.isPackaged || !target) {
      // 开发模式不真正替换（execPath 指向 Electron.app）
      sendMain('pf:update:ready-dev', { newApp, target })
      return
    }
    // 存好本版 zip+blockmap 供下次差量比对（best-effort，存不下不影响本次更新）
    await saveArtifactsForNextDiff(zip, info).catch(() => {})
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
