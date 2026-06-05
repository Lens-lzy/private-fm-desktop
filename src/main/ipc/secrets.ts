import { ipcMain, safeStorage } from 'electron'
import Store from 'electron-store'

/**
 * token 安全存储：优先用 Electron safeStorage（macOS 走系统 Keychain 加密），
 * 把密文 base64 落到 electron-store。若加密不可用则降级明文存储。
 */
const store = new Store<{ tokenEnc?: string; tokenPlain?: string }>({ name: 'secrets' })

function readToken(): string {
  const enc = store.get('tokenEnc')
  if (enc) {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(enc, 'base64'))
      }
    } catch {
      /* 解密失败则落到明文回退 */
    }
  }
  return store.get('tokenPlain') ?? ''
}

function writeToken(token: string): void {
  if (!token) {
    store.delete('tokenEnc')
    store.delete('tokenPlain')
    return
  }
  if (safeStorage.isEncryptionAvailable()) {
    store.set('tokenEnc', safeStorage.encryptString(token).toString('base64'))
    store.delete('tokenPlain')
  } else {
    store.set('tokenPlain', token)
    store.delete('tokenEnc')
  }
}

export function registerSecretsIpc(): void {
  ipcMain.handle('pf:secrets:get-token', () => readToken())
  ipcMain.handle('pf:secrets:set-token', (_e, token: string) => writeToken(String(token || '')))
  ipcMain.handle('pf:secrets:clear-token', () => writeToken(''))
}
