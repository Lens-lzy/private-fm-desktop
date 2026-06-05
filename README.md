# Private FM — 桌面客户端（Electron + Vue3）

对标 Spotify 的私域音乐播放器桌面端，复用 `web-music-dist` 的后端 HTTP API。
技术栈：Electron + electron-vite + Vue 3 + TypeScript + Pinia + Vue Router。仅 macOS。

## 开发

```bash
npm install                      # 首次安装依赖（如下载 Electron 二进制慢，可用镜像，见下）
npm run dev                      # electron-vite dev：HMR + 主进程热重启
```

> Electron 二进制下载慢/失败时，用镜像：
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`

应用默认连线上后端 `https://fm.bonjor.fun`（Cloudflare Tunnel + 自有域名）；登录页/「设置」里可改服务器地址。本地联调用临时实例：

```bash
cd ../web-music-dist
WEB_MUSIC_DATA_DIR=/tmp/pf-test PORT=9278 WEB_MUSIC_ADMIN_PASSWORD=test1234 node server/index.js
# 管理员：admin / test1234；应用设置里把服务器地址改成 http://localhost:9278
```

## 构建 / 打包（macOS，未签名）

```bash
npm run typecheck                # 类型检查（main/preload + renderer）
npm run build                    # 构建三 target 到 out/
npm run pack:mac                 # 出 .app（dir，快验）
npm run dist:mac                 # 出 .dmg + .app（未签名）
```

> 无付费 Apple 账号 → 产物未签名未公证。朋友首次打开被 Gatekeeper 拦时：
> 右键「打开」，或终端执行 `xattr -dr com.apple.quarantine "/Applications/Private FM.app"`。

## 架构

- `src/main/` 主进程：窗口、CORS 注入（`cors.ts`）、token safeStorage（`ipc/secrets.ts`）、
  配置 electron-store（`ipc/config.ts`）；后续接入桌面歌词窗口、托盘、媒体键。
- `src/preload/` contextBridge 窄接口 → `window.pf`。
- `src/renderer/src/` Vue 渲染层：`services/`（http/api/urls/songKey/session）、
  `stores/`（Pinia 按域拆分）、`views/`、`components/`。HTML5 `<audio>` 实际播放放渲染层。

后端 API 契约与歌曲唯一键 `source:(songmid|songId|name+singer)` 见仓库根的实现计划。

## 给朋友 / 安装（macOS）

1. 到 [Releases](https://github.com/Lens-lzy/private-fm-desktop/releases/latest) 下载 `Private FM-<版本>-arm64.dmg`（Apple 芯片）。
2. 打开 dmg，把 **Private FM** 拖进「应用程序」。
3. 首次打开被 Gatekeeper 拦（未签名）：**右键图标 →「打开」→ 再点「打开」**。
   仍打不开就终端执行：`xattr -dr com.apple.quarantine "/Applications/Private FM.app"` 后再开。
4. 用管理员发的账号/邀请码登录即可。服务器地址已内置，无需填写。

之后有新版本，App 启动会自动弹「发现新版本」→ 点**立即更新** → 跑完进度条自动装好重启；也可在「设置 → 关于 → 检查更新」手动触发。

## 发布新版本（维护者）

一次完整发版（详细步骤同步在 Claude 项目记忆 `release-runbook`）：

```bash
# 1. 改完代码后，bump 版本号（package.json version，如 1.0.0-beta.1 → 1.0.0）
# 2. 类型检查必须全绿
npm run typecheck
# 3. 打包出 dmg + zip（zip = .app 压缩包，供应用内自动更新下载替换）
npm run dist:mac            # 仅 Apple 芯片；Intel 朋友需另跑 npm run dist:mac -- --x64
# 4. 提交并推送代码
git add -A && git commit -m "release vX.Y.Z" && git push
# 5. 建 GitHub Release（tag=vX.Y.Z，notes 即更新弹窗里显示的更新说明，资产传 dmg+zip）
gh release create vX.Y.Z "dist/Private FM-X.Y.Z-arm64.dmg" "dist/Private FM-X.Y.Z-arm64.zip" \
  --title "vX.Y.Z" --notes "更新说明…"
```

要点：tag 用 `vX.Y.Z`（更新器自动去掉前缀 v）；Release 必须**发布（非草稿）**才会被检测；正式版 > 预发布（`1.0.0` 比 `1.0.0-beta.1` 新）。自动更新只对**新于用户当前版本**的 latest release 生效。
