const { app, BrowserWindow, shell, ipcMain, dialog, desktopCapturer, globalShortcut, screen } = require("electron")
const path = require("path")
const { spawn, fork, spawnSync } = require("child_process")
const http = require("http")
const net = require("net")
const fs = require("fs")
const crypto = require("crypto")
const { autoUpdater } = require("electron-updater")

// EPIPE 완전 차단 — Electron에서 부모 파이프 닫힌 후 stdout/stderr write 시 발생
process.stdout?.on("error", () => {})
process.stderr?.on("error", () => {})
process.on("uncaughtException", (err) => {
  if (err.code === "EPIPE" || err.code === "ERR_STREAM_DESTROYED") return
  // console.error도 EPIPE 유발하므로 dialog만 사용
  try { require("electron").dialog.showErrorBox("Error", `${err.stack || err.message}`) } catch {}
})

const isDev = !app.isPackaged
const ROOT = path.join(__dirname, "..")
function parsePort(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback
}

const BACKEND_PORT = parsePort(process.env.GT_BACKEND_PORT, isDev ? 8001 : 8000)
const BACKEND_API = process.env.GT_BACKEND_API || `http://127.0.0.1:${BACKEND_PORT}/api`
const DEFAULT_FRONTEND_PORT = 3100
const APP_NAME = "Varo"
const APP_ICON_PNG = path.join(ROOT, "build", "icon.png")
const IMPORT_GRANT_SECRET = process.env.GT_IMPORT_GRANT_SECRET || crypto.randomBytes(32).toString("hex")
let frontendPort = DEFAULT_FRONTEND_PORT

app.setName(APP_NAME)
app.setAppUserModelId("com.gametranslator.app")

// userData 경로를 고정 — NSIS installer와 일치시키기 위해
// app.getPath("userData")는 productName("게임번역기")을 사용하지만
// 영문 경로로 통일하여 한국어 경로 문제 방지
if (isDev) {
  app.setPath("userData", path.join(app.getPath("temp"), `game-translator-dev-${process.pid}`))
} else {
  app.setPath("userData", path.join(app.getPath("appData"), "game-translator"))
}

let mainWindow = null
let backendProcess = null
let frontendProcess = null
const gameWindows = new Map() // gameId -> BrowserWindow
let overlayWindow = null
let regionSelectWindow = null
let autoCaptureInterval = null
let trackingWindowId = null

// ── Helpers ──

function appendDevLog(name, data) {
  if (!isDev) return
  try {
    const logDir = path.join(ROOT, "logs")
    fs.mkdirSync(logDir, { recursive: true })
    fs.appendFileSync(path.join(logDir, name), data)
  } catch {}
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(1000)
    socket.once("connect", () => finish(true))
    socket.once("timeout", () => finish(false))
    socket.once("error", () => finish(false))
    socket.connect(port, "127.0.0.1")
  })
}

function isHttpReady(url, timeout = 2000) {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const req = http.get(url, (res) => {
      res.resume()
      finish(res.statusCode >= 200 && res.statusCode < 500)
    })
    req.setTimeout(timeout, () => {
      req.destroy()
      finish(false)
    })
    req.on("error", () => finish(false))
    req.end()
  })
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function createImportGrant(filePath, action) {
  const payload = {
    path: path.resolve(filePath),
    action,
    exp: Math.floor(Date.now() / 1000) + 5 * 60,
    nonce: crypto.randomUUID(),
  }
  const payloadB64 = base64UrlJson(payload)
  const signature = crypto.createHmac("sha256", IMPORT_GRANT_SECRET).update(payloadB64).digest("hex")
  return `${payloadB64}.${signature}`
}

async function findAvailablePort(start, end) {
  for (let port = start; port <= end; port += 1) {
    if (!(await isPortInUse(port))) return port
  }
  return null
}

function waitForHttp(url, label, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = async () => {
      if (await isHttpReady(url)) {
        resolve(true)
        return
      }
      if (Date.now() - start > timeout) {
        reject(new Error(`Timeout waiting for ${label}`))
        return
      }
      setTimeout(check, 500)
    }
    check()
  })
}

function waitForServer(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = async () => {
      if (await isPortInUse(port)) {
        resolve(true)
        return
      }
      if (Date.now() - start > timeout) {
        reject(new Error(`Timeout waiting for port ${port}`))
        return
      }
      setTimeout(check, 500)
    }
    check()
  })
}

function killProcess(proc) {
  if (!proc || proc.killed) return
  try {
    if (process.platform === "win32") {
      const { execSync } = require("child_process")
      try {
        execSync(`taskkill /pid ${proc.pid} /f /t`, { stdio: "ignore", timeout: 5000 })
      } catch {}
    } else {
      proc.kill("SIGTERM")
    }
  } catch {}
}

/** Kill any process listening on a port (fallback for orphaned children) */
function killByPort(port) {
  if (process.platform !== "win32") return
  const { execSync } = require("child_process")
  try {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { stdio: "pipe", timeout: 3000 }).toString()
    const match = out.match(/LISTENING\s+(\d+)/)
    if (match) {
      execSync(`taskkill /pid ${match[1]} /f /t`, { stdio: "ignore", timeout: 3000 })
    }
  } catch {}
}

let _cachedPython = null
function addUniqueCandidate(candidates, seen, command, args = []) {
  if (!command) return
  const key = `${command}\0${args.join("\0")}`
  if (seen.has(key)) return
  seen.add(key)
  candidates.push({ command, args })
}

function pythonCandidates() {
  const candidates = []
  const seen = new Set()
  addUniqueCandidate(candidates, seen, process.env.PYTHON)

  for (const localPath of [
    path.join(ROOT, ".venv312", "bin", "python"),
    path.join(ROOT, ".venv", "bin", "python"),
    path.join(ROOT, "venv", "bin", "python"),
    path.join("/private", "tmp", "varo-backend-venv", "bin", "python"),
  ]) {
    if (fs.existsSync(localPath)) addUniqueCandidate(candidates, seen, localPath)
  }

  if (process.platform === "win32") addUniqueCandidate(candidates, seen, "py", ["-3"])
  addUniqueCandidate(candidates, seen, "python3")
  addUniqueCandidate(candidates, seen, "python")
  if (process.platform === "win32") addUniqueCandidate(candidates, seen, "py")
  return candidates
}

function findPython() {
  if (_cachedPython) return _cachedPython
  for (const candidate of pythonCandidates()) {
    const result = spawnSync(
      candidate.command,
      [
        ...candidate.args,
        "-c",
        "import importlib.util, sys; raise SystemExit(0 if importlib.util.find_spec('uvicorn') else 1); print(sys.executable)",
      ],
      { encoding: "utf8", windowsHide: true }
    )
    if (result.status === 0) {
      const pathResult = spawnSync(
        candidate.command,
        [...candidate.args, "-c", "import sys; print(sys.executable)"],
        { encoding: "utf8", windowsHide: true }
      )
      const fullPath = pathResult.stdout.trim().split(/\r?\n/)[0]
      if (fullPath) {
        _cachedPython = fullPath
        return fullPath
      }
    }
  }
  return null
}

function resolveBackendExecutable(backendDir) {
  const names = process.platform === "win32" ? ["backend.exe", "backend"] : ["backend", "backend.exe"]
  for (const name of names) {
    const target = path.join(backendDir, name)
    if (fs.existsSync(target)) return target
  }
  return path.join(backendDir, names[0])
}

function ensureExecutable(filePath) {
  if (process.platform === "win32" || !fs.existsSync(filePath)) return
  try {
    const stat = fs.statSync(filePath)
    fs.chmodSync(filePath, stat.mode | 0o755)
  } catch {}
}

// ── Server Management ──

async function startBackend() {
  if (await isHttpReady(`http://127.0.0.1:${BACKEND_PORT}/api/health`)) {
    console.log("[electron] Backend health is OK on port", BACKEND_PORT)
    return
  }
  if (await isPortInUse(BACKEND_PORT)) {
    console.log("[electron] Backend port is occupied but health check is not ready", BACKEND_PORT)
    return
  }
  console.log("[electron] Starting backend...")
  if (isDev) {
    const pythonCmd = findPython()
    if (!pythonCmd) {
      showStartupError(
        "개발용 백엔드 시작 실패",
        "Python 3.10 이상을 찾지 못했습니다. 앱은 열렸지만 로컬 서버가 시작되지 않아 화면을 표시할 수 없습니다."
      )
      dialog.showErrorBox(
        "Python Not Found",
        "Python is required to run the backend in dev mode.\nPlease install Python 3.10+ from https://python.org and restart the app."
      )
      return
    }
    backendProcess = spawn(
      pythonCmd,
      [
        "-m", "uvicorn", "backend.server:app",
        "--host", "127.0.0.1",
        "--port", String(BACKEND_PORT),
        "--reload",
      ],
      {
        cwd: ROOT,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GT_DATA_DIR: path.join(ROOT, "data"), GT_IMPORT_GRANT_SECRET: IMPORT_GRANT_SECRET },
      }
    )
  } else {
    // Production: run PyInstaller-built backend binary.
    // Use userData for persistent data (survives app updates)
    const backendDir = path.join(process.resourcesPath, "backend-dist")
    const backendExe = resolveBackendExecutable(backendDir)
    if (!fs.existsSync(backendExe)) {
      const detail = `백엔드 실행 파일을 찾지 못했습니다. 예상 위치: ${backendExe}`
      console.error("[electron] Backend executable missing:", backendExe)
      showStartupError("Varo 시작 실패", detail)
      dialog.showErrorBox(
        "Varo 시작 실패",
        `${detail}\n\n앱 패키지에 백엔드가 포함되지 않았습니다. 최신 빌드로 다시 설치해주세요.`
      )
      return
    }
    ensureExecutable(backendExe)
    const dataDir = path.join(app.getPath("userData"), "data")
    fs.mkdirSync(dataDir, { recursive: true })

    // One-time migration: copy DB from old location to userData
    const userDb = path.join(dataDir, "library.db")
    if (!fs.existsSync(userDb) || fs.statSync(userDb).size < 1024) {
      const copyRecursive = (src, dest) => {
        if (fs.statSync(src).isDirectory()) {
          fs.mkdirSync(dest, { recursive: true })
          for (const item of fs.readdirSync(src)) {
            copyRecursive(path.join(src, item), path.join(dest, item))
          }
        } else {
          fs.copyFileSync(src, dest)
        }
      }

      // Search order for old DB:
      // 1. resources/data/ (bundled with older builds)
      // 2. Previous install paths (NSIS overwrites resources/ on update)
      const oldCandidates = [
        // 이전 버전의 userData (한국어 경로 사용하던 시절)
        path.join(app.getPath("appData"), "게임번역기", "data"),
        path.join(process.resourcesPath, "data"),
        // Common install locations where previous version may have stored data
        path.join(path.dirname(process.resourcesPath), "..", "resources", "data"),
        path.join(app.getPath("home"), "AppData", "Local", "Programs", "game-translator", "resources", "data"),
        path.join("C:\\Program Files", "게임번역기", "resources", "data"),
        path.join("C:\\Program Files (x86)", "게임번역기", "resources", "data"),
      ]

      for (const oldDataDir of oldCandidates) {
        const oldDb = path.join(oldDataDir, "library.db")
        try {
          if (fs.existsSync(oldDb) && fs.statSync(oldDb).size > 1024) {
            console.log("[migration] Found old DB at:", oldDataDir)
            copyRecursive(oldDataDir, dataDir)
            break
          }
        } catch {}
      }
    }

    backendProcess = spawn(
      backendExe,
      [
        "--host", "127.0.0.1",
        "--port", String(BACKEND_PORT),
        "--data-dir", dataDir,
      ],
      {
        cwd: backendDir,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, GT_IMPORT_GRANT_SECRET: IMPORT_GRANT_SECRET },
      }
    )
  }
  backendProcess.stdout?.on("data", (data) => appendDevLog("backend-dev.out.log", data))
  backendProcess.stderr?.on("data", (data) => appendDevLog("backend-dev.err.log", data))
  backendProcess.stdout?.on("error", () => {})
  backendProcess.stderr?.on("error", () => {})
  backendProcess.on("error", (err) => {
    if (!isDev) {
      showStartupError(
        "백엔드 실행 실패",
        `로컬 미디어 서버를 시작하지 못했습니다. ${err.message}`
      )
      try {
        dialog.showErrorBox(
          "Backend Error",
          `백엔드 실행 실패: ${err.message}\n\n보안 프로그램이 앱 내부 백엔드를 차단했거나 패키지 파일이 손상되었을 수 있습니다.`
        )
      } catch {}
    }
  })
  backendProcess.on("exit", (code) => {
    if (code !== null && code !== 0 && !isDev) {
      showStartupError(
        "백엔드가 비정상 종료되었습니다",
        `로컬 미디어 서버가 시작 중 종료되었습니다. 종료 코드: ${code}`
      )
      try {
        dialog.showErrorBox(
          "Backend Crashed",
          `백엔드가 비정상 종료되었습니다 (코드: ${code}).\n앱을 재시작해주세요.`
        )
      } catch {}
    }
  })
}

async function startFrontend() {
  frontendPort = DEFAULT_FRONTEND_PORT
  const frontendReadyUrl = (port) => `http://127.0.0.1:${port}/`

  if (await isHttpReady(frontendReadyUrl(frontendPort))) {
    console.log("[electron] Frontend HTTP is ready on port", frontendPort)
    return
  }
  if (isDev && process.env.GT_EXTERNAL_FRONTEND === "1") {
    console.log("[electron] Using external frontend on port", frontendPort)
    return
  }
  if (await isPortInUse(frontendPort)) {
    console.log("[electron] Frontend port is occupied but HTTP is not ready", frontendPort)
    const start = Date.now()
    while (Date.now() - start < 5000) {
      await delay(500)
      if (await isHttpReady(frontendReadyUrl(frontendPort))) {
        console.log("[electron] Frontend HTTP became ready on port", frontendPort)
        return
      }
      if (!(await isPortInUse(frontendPort))) break
    }
    if (await isPortInUse(frontendPort)) {
      console.log("[electron] Frontend port stayed occupied without HTTP", frontendPort)
      if (!isDev) return
      const fallbackPort = await findAvailablePort(DEFAULT_FRONTEND_PORT + 1, DEFAULT_FRONTEND_PORT + 10)
      if (!fallbackPort) {
        console.log("[electron] No fallback frontend port is available")
        return
      }
      frontendPort = fallbackPort
      console.log("[electron] Using fallback frontend port", frontendPort)
    }
  }
  console.log("[electron] Starting frontend...")
  if (isDev) {
    const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next")
    frontendProcess = spawn(
      "node", [nextBin, "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(frontendPort)],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          HOSTNAME: "127.0.0.1",
          GT_BACKEND_PORT: String(BACKEND_PORT),
          GT_BACKEND_API: BACKEND_API,
          NEXT_PUBLIC_GT_BACKEND_API: process.env.NEXT_PUBLIC_GT_BACKEND_API || BACKEND_API,
          NEXT_TELEMETRY_DISABLED: "1",
          NEXT_DEV_DIST_DIR: ".next-electron-dev",
        },
        stdio: ["ignore", "pipe", "pipe"],
        shell: false,
        windowsHide: true,
      }
    )
  } else {
    // Production: run Next.js standalone server
    const serverJs = path.join(process.resourcesPath, "frontend", "server.js")
    if (!fs.existsSync(serverJs)) {
      showStartupError(
        "프론트엔드 번들 누락",
        `앱 화면 파일을 찾지 못했습니다. 예상 위치: ${serverJs}`
      )
      return
    }
    frontendProcess = fork(serverJs, [], {
      cwd: path.dirname(serverJs),
      env: {
        ...process.env,
        PORT: String(frontendPort),
        HOSTNAME: "127.0.0.1",
        GT_BACKEND_PORT: String(BACKEND_PORT),
        GT_BACKEND_API: BACKEND_API,
        NEXT_PUBLIC_GT_BACKEND_API: process.env.NEXT_PUBLIC_GT_BACKEND_API || BACKEND_API,
        NODE_ENV: "production",
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    })
  }
  if (!frontendProcess) return
  // 파이프 읽되 에러 무시 (EPIPE 방지)
  frontendProcess.stdout?.on("data", (data) => {
    appendDevLog("frontend-dev.out.log", data)
    if (!isDev) console.log(`[frontend] ${data.toString().trimEnd()}`)
  })
  frontendProcess.stderr?.on("data", (data) => {
    appendDevLog("frontend-dev.err.log", data)
    if (!isDev) console.error(`[frontend] ${data.toString().trimEnd()}`)
  })
  frontendProcess.stdout?.on("error", () => {})
  frontendProcess.stderr?.on("error", () => {})
  frontendProcess.on("error", (error) => {
    appendDevLog("frontend-dev.err.log", `[electron] Frontend process error: ${error.message}\n`)
    if (!isDev) {
      showStartupError(
        "프론트엔드 실행 실패",
        `앱 화면 서버를 시작하지 못했습니다. ${error.message}`
      )
    }
  })
  frontendProcess.on("exit", (code, signal) => {
    appendDevLog(
      "frontend-dev.err.log",
      `[electron] Frontend process exited. code=${code ?? "null"} signal=${signal ?? "null"}\n`
    )
    frontendProcess = null
  })
}

// ── Window ──

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
}

function htmlDataUrl(html) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
}

function startupPageUrl(message = "Varo 시작 중", detail = "로컬 미디어 서버를 준비하고 있습니다.") {
  const safeMessage = escapeHtml(message)
  const safeDetail = escapeHtml(detail)
  return htmlDataUrl(`
    <html>
      <head>
        <title>Varo</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            background: #0c0c0f;
            color: #f4f4f5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .panel {
            width: min(420px, calc(100vw - 48px));
            display: grid;
            gap: 14px;
            justify-items: center;
            text-align: center;
          }
          .mark {
            width: 58px;
            height: 58px;
            border-radius: 18px;
            background: #6366f1;
            display: grid;
            place-items: center;
            color: white;
            font-weight: 800;
            font-size: 26px;
          }
          .spinner {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 3px solid rgba(255,255,255,.18);
            border-top-color: #818cf8;
            animation: spin 1s linear infinite;
          }
          h1 { margin: 4px 0 0; font-size: 22px; line-height: 1.25; }
          p { margin: 0; color: #9ca3af; font-size: 14px; line-height: 1.6; }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <main class="panel">
          <div class="mark">V</div>
          <div class="spinner" aria-label="loading"></div>
          <h1>${safeMessage}</h1>
          <p>${safeDetail}</p>
        </main>
      </body>
    </html>
  `)
}

async function loadFrontendWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const appUrl = `http://127.0.0.1:${frontendPort}/`
  console.log("[electron] Loading frontend URL:", appUrl)
  try {
    await mainWindow.loadURL(appUrl)
  } catch (error) {
    console.error("[electron] Frontend loadURL failed:", error.message)
    showStartupError("앱 화면 로드 실패", `프론트엔드 주소를 열지 못했습니다. ${error.message}`)
    return
  }
  mainWindow.show()
}

function showStartupError(title = "Varo 시작 실패", detail = "알 수 없는 오류가 발생했습니다.") {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const safeTitle = escapeHtml(title)
  const safeDetail = escapeHtml(detail)
  mainWindow.show()
  mainWindow.webContents.loadURL(htmlDataUrl(`
    <html>
      <head>
        <title>Varo</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            background: #0c0c0f;
            color: #f4f4f5;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .panel {
            width: min(520px, calc(100vw - 48px));
            padding: 28px;
            border: 1px solid rgba(248,113,113,.35);
            border-radius: 18px;
            background: rgba(127,29,29,.16);
            display: grid;
            gap: 12px;
          }
          .eyebrow { color: #f87171; font-size: 13px; font-weight: 700; }
          h1 { margin: 0; font-size: 23px; line-height: 1.3; }
          p { margin: 0; color: #cbd5e1; font-size: 14px; line-height: 1.65; word-break: break-word; }
          button {
            width: max-content;
            margin-top: 8px;
            padding: 9px 18px;
            border: 0;
            border-radius: 10px;
            background: #6366f1;
            color: white;
            font-size: 14px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <main class="panel">
          <div class="eyebrow">시작 오류</div>
          <h1>${safeTitle}</h1>
          <p>${safeDetail}</p>
          <button onclick="location.href='http://127.0.0.1:${frontendPort}/'">다시 시도</button>
        </main>
      </body>
    </html>
  `))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0c0c0f",
    icon: APP_ICON_PNG,
    show: false,
    title: "Game Translator Dev",
    acceptFirstMouse: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#0c0c0f",
      symbolColor: "#9898a3",
      height: 36,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  mainWindow.loadURL(startupPageUrl())

  // Show window when ready, with timeout fallback
  let shown = false
  const showOnce = () => {
    if (shown || !mainWindow) return
    shown = true
    console.log("[electron] Showing main window")
    mainWindow.show()
    mainWindow.restore()
    mainWindow.focus()
  }

  mainWindow.once("ready-to-show", showOnce)

  // Fallback: force show after 15s even if page fails to load
  setTimeout(showOnce, 15000)

  // Handle load failure — show error page instead of staying hidden
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDesc, validatedURL) => {
    console.error(`[electron] Page load failed: ${errorCode} ${errorDesc} (${validatedURL})`)
    showOnce()
    showStartupError(
      "서버 시작 실패",
      `앱 화면 서버에 연결할 수 없습니다. 오류: ${errorDesc}. 주소: ${validatedURL}`
    )
  })

  // Inject Electron-specific CSS (drag region, titlebar padding)
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.insertCSS(`
      /* Electron drag region — sidebar header becomes the drag handle */
      .sidebar-drag-region {
        -webkit-app-region: drag;
      }
      .sidebar-drag-region a,
      .sidebar-drag-region button {
        -webkit-app-region: no-drag;
      }
      main,
      nav,
      a,
      button,
      input,
      textarea,
      select,
      label,
      [role="button"],
      [role="link"] {
        -webkit-app-region: no-drag;
      }
      /* Push sidebar down for titlebar overlay */
      .electron-titlebar-pad {
        padding-top: 8px;
      }
      /* Reserve space for titlebar overlay buttons (close/min/max) */
      html.is-electron main {
        padding-right: 140px;
      }
      /* Hide Next.js dev tools button */
      button[data-nextjs-dev-tools-button],
      [data-nextjs-dev-tools],
      body > button:last-of-type[style*="position"] {
        display: none !important;
      }
      nextjs-portal { display: none !important; }
    `)
    // Mark body so React components can detect Electron
    mainWindow.webContents.executeJavaScript(`
      document.documentElement.classList.add('is-electron');
    `)
    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: "detach" })
      mainWindow.webContents.executeJavaScript(`
        new MutationObserver(() => {
          document.querySelectorAll('button').forEach(b => {
            if (b.textContent?.includes('Next.js Dev Tools')) b.style.display = 'none';
          });
          document.querySelectorAll('nextjs-portal').forEach(e => e.style.display = 'none');
        }).observe(document.body, { childList: true, subtree: true });
      `)
    }
  })

  // External links open in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === "https:" || parsed.protocol === "http:") {
        shell.openExternal(url)
      }
    } catch {
      console.warn("[electron] Blocked malformed window URL:", url)
    }
    return { action: "deny" }
  })

  mainWindow.on("closed", () => {
    mainWindow = null
    // Main window closed = user wants to quit. Force cleanup and exit.
    cleanup()
    app.quit()
  })
}

// ── Auto Update ──

autoUpdater.autoDownload = true
autoUpdater.setFeedURL({
  provider: "generic",
  url: "https://api.closedclaws.com/api/update",
})

function setupAutoUpdater() {
  // Check for updates 5 seconds after window loads
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000)

  autoUpdater.on("update-available", (info) => {
    mainWindow?.webContents.send("update-available", {
      version: info.version,
      releaseDate: info.releaseDate,
    })
  })

  autoUpdater.on("download-progress", (progress) => {
    mainWindow?.webContents.send("update-progress", {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on("update-downloaded", () => {
    mainWindow?.webContents.send("update-downloaded")
  })

  autoUpdater.on("error", (err) => {
    console.error("[updater] Error:", err.message)
  })
}

// ── IPC Handlers ──

ipcMain.handle("get-app-version", () => app.getVersion())
ipcMain.handle("check-for-updates", async () => {
  try {
    const result = await autoUpdater.checkForUpdates()
    return result?.updateInfo ?? null
  } catch {
    return null
  }
})
ipcMain.handle("download-update", () => autoUpdater.downloadUpdate())
ipcMain.handle("install-update", () => autoUpdater.quitAndInstall())

// Confirm dialog (native)
ipcMain.handle("show-confirm-dialog", async (event, message) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = await dialog.showMessageBox(win || mainWindow, {
    type: "warning",
    buttons: ["Cancel", "OK"],
    defaultId: 0,
    cancelId: 0,
    message: typeof message === "string" ? message : "Are you sure?",
  })
  return result.response === 1
})

// Game folder / ZIP dialog
ipcMain.handle("select-game-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select game folder or ZIP",
    properties: ["openDirectory", "openFile"],
    filters: [{ name: "ZIP", extensions: ["zip"] }],
  })
  return result.filePaths[0] || ""
})

// APK file dialogs
ipcMain.handle("select-apk-file", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select APK files",
    filters: [{ name: "APK", extensions: ["apk"] }],
    properties: ["openFile", "multiSelections"],
  })
  return result.filePaths
})

ipcMain.handle("select-apk-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select folder containing APK files",
    properties: ["openDirectory"],
  })
  return result.filePaths[0] || ""
})

// Subtitle/text file dialog
ipcMain.handle("select-subtitle-files", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select subtitle/text files",
    filters: [{ name: "Subtitle", extensions: ["srt", "ass", "ssa", "vtt", "txt"] }],
    properties: ["openFile", "multiSelections"],
  })
  return result.filePaths
})

// Novel/text file dialog
ipcMain.handle("select-novel-files", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select novel/text files",
    filters: [
      {
        name: "Novel/Text",
        extensions: ["txt", "md", "markdown", "log", "csv", "json", "xml", "html", "htm", "srt", "vtt", "ass", "ssa", "rpy", "ks", "epub", "pdf"],
      },
    ],
    properties: ["openFile", "multiSelections"],
  })
  return result.filePaths.map((filePath) => ({
    path: filePath,
    source_grant: createImportGrant(filePath, "file-import"),
  }))
})

// Video file dialogs
ipcMain.handle("select-video-files", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select video files",
    filters: [{ name: "Video", extensions: ["mp4", "mkv", "webm", "avi", "mov"] }],
    properties: ["openFile", "multiSelections"],
  })
  return result.filePaths
})

ipcMain.handle("select-video-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select folder containing video files",
    properties: ["openDirectory"],
  })
  return result.filePaths[0] || ""
})

ipcMain.handle("select-audio-folder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select folder containing audio files",
    properties: ["openDirectory"],
  })
  return result.filePaths[0] || ""
})

ipcMain.handle("launch-native-game", async (event, { exePath }) => {
  if (!exePath || typeof exePath !== "string") {
    throw new Error("Missing executable path")
  }

  if (!fs.existsSync(exePath)) {
    throw new Error(`Executable not found: ${exePath}`)
  }

  const cwd = path.dirname(exePath)
  const child = spawn(exePath, [], {
    cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  })
  child.unref()
  return { ok: true, pid: child.pid }
})

// HTML game window
ipcMain.handle("open-html-game", async (event, { gameId, title, serveUrl }) => {
  const existing = gameWindows.get(gameId)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
  }

  // 방어선: 이 게임에 네이티브 exe가 있으면 BrowserWindow로 열지 않음
  // (백엔드가 이미 subprocess.Popen으로 실행했어야 함)
  try {
    const res = await fetch(`http://localhost:${BACKEND_PORT}/api/games/${gameId}`)
    if (res.ok) {
      const g = await res.json()
      if (g?.exe_path) {
        console.warn(`[open-html-game] refused — game ${gameId} has exe_path=${g.exe_path}`)
        return
      }
    }
  } catch (e) {
    console.warn(`[open-html-game] exe_path probe failed:`, e?.message || e)
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: "#000000",
    autoHideMenuBar: true,
    title: title || "Game",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.loadURL(`http://localhost:${BACKEND_PORT}${serveUrl}`)

  // F11 fullscreen toggle, ESC to exit fullscreen
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type === "keyDown") {
      if (input.key === "F11") {
        win.setFullScreen(!win.isFullScreen())
        e.preventDefault()
      } else if (input.key === "Escape" && win.isFullScreen()) {
        win.setFullScreen(false)
        e.preventDefault()
      }
    }
  })

  win.on("closed", () => {
    gameWindows.delete(gameId)
  })

  gameWindows.set(gameId, win)
})

ipcMain.handle("close-html-game", (event, { gameId }) => {
  const win = gameWindows.get(gameId)
  if (win && !win.isDestroyed()) {
    win.close()
  }
  gameWindows.delete(gameId)
})

// ── Live Translation IPC ──

// List available capture sources (windows/screens)
ipcMain.handle("live:list-sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  })
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
    icon: s.appIcon ? s.appIcon.toDataURL() : null,
    isScreen: s.id.startsWith("screen:"),
  }))
})

// Capture a specific source and return base64 image
ipcMain.handle("live:capture-screen", async (event, { sourceId, region }) => {
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: { width: 1920, height: 1080 },
  })
  const source = sources.find((s) => s.id === sourceId)
  if (!source) return { error: "Source not found", errorCode: "captureSourceNotFound" }

  let image = source.thumbnail
  if (region && region.x != null) {
    image = image.crop({
      x: Math.round(region.x),
      y: Math.round(region.y),
      width: Math.round(region.width),
      height: Math.round(region.height),
    })
  }
  return { image: image.toPNG().toString("base64") }
})

// Overlay window management
ipcMain.handle("live:show-overlay", (event, { bounds }) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show()
    if (bounds) overlayWindow.setBounds(bounds)
    return
  }

  // Default: full primary display (transparent except for text blocks)
  const display = screen.getPrimaryDisplay()
  const overlayBounds = bounds || {
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
  }

  overlayWindow = new BrowserWindow({
    ...overlayBounds,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    focusable: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Windows: setIgnoreMouseEvents(true) makes all clicks pass through
  overlayWindow.setIgnoreMouseEvents(true)
  overlayWindow.loadURL(`http://localhost:${frontendPort}/overlay`)

  // Inject transparent background override (ensure no white flash)
  overlayWindow.webContents.on("did-finish-load", () => {
    overlayWindow.webContents.insertCSS(`
      html, body { background: transparent !important; margin: 0; padding: 0; overflow: hidden; }
    `)
  })

  overlayWindow.on("closed", () => { overlayWindow = null })
})

ipcMain.handle("live:hide-overlay", () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide()
  }
})

ipcMain.handle("live:update-overlay", (event, { data }) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("live:overlay-data", data)
  }
})

ipcMain.handle("live:set-overlay-bounds", (event, bounds) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setBounds(bounds)
  }
})

// Region selection window
ipcMain.handle("live:select-region", async () => {
  return new Promise((resolve) => {
    if (regionSelectWindow && !regionSelectWindow.isDestroyed()) {
      regionSelectWindow.focus()
      return resolve(null)
    }

    const display = screen.getPrimaryDisplay()
    regionSelectWindow = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      fullscreen: true,
      skipTaskbar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    regionSelectWindow.loadURL(`http://localhost:${frontendPort}/region-select`)

    ipcMain.once("live:region-selected", (e, region) => {
      if (regionSelectWindow && !regionSelectWindow.isDestroyed()) {
        regionSelectWindow.close()
      }
      regionSelectWindow = null
      resolve(region)
    })

    regionSelectWindow.on("closed", () => {
      regionSelectWindow = null
      resolve(null)
    })
  })
})

ipcMain.handle("live:confirm-region", (event, region) => {
  ipcMain.emit("live:region-selected", event, region)
})

// Window tracking (for overlay sync when game window moves)
ipcMain.handle("live:track-window", (event, { sourceId }) => {
  trackingWindowId = sourceId
})

ipcMain.handle("live:get-window-bounds", async (event, { sourceId }) => {
  // desktopCapturer doesn't provide window bounds directly;
  // we use a lightweight re-capture to track position changes
  const sources = await desktopCapturer.getSources({
    types: ["window"],
    thumbnailSize: { width: 1, height: 1 },
  })
  const source = sources.find((s) => s.id === sourceId)
  return source ? { found: true, name: source.name } : { found: false }
})

// Auto capture control
ipcMain.handle("live:start-auto-capture", (event, { sourceId, intervalMs, region }) => {
  if (autoCaptureInterval) clearInterval(autoCaptureInterval)

  autoCaptureInterval = setInterval(async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: { width: 1920, height: 1080 },
      })
      const source = sources.find((s) => s.id === sourceId)
      if (!source) return

      let image = source.thumbnail
      if (region && region.x != null) {
        image = image.crop({
          x: Math.round(region.x),
          y: Math.round(region.y),
          width: Math.round(region.width),
          height: Math.round(region.height),
        })
      }

      const b64 = image.toPNG().toString("base64")
      mainWindow?.webContents.send("live:auto-capture-frame", { image: b64 })
    } catch (err) {
      console.error("[live] Auto capture error:", err.message)
    }
  }, intervalMs || 2000)
})

ipcMain.handle("live:stop-auto-capture", () => {
  if (autoCaptureInterval) {
    clearInterval(autoCaptureInterval)
    autoCaptureInterval = null
  }
})

// Global hotkeys for live translation
ipcMain.handle("live:register-hotkeys", () => {
  // Ctrl+Shift+T: Toggle live translation capture
  globalShortcut.register("CommandOrControl+Shift+T", () => {
    mainWindow?.webContents.send("live:hotkey-capture")
  })
  // Ctrl+Shift+O: Toggle overlay
  globalShortcut.register("CommandOrControl+Shift+O", () => {
    mainWindow?.webContents.send("live:hotkey-overlay")
  })
  // Ctrl+Shift+R: Select region
  globalShortcut.register("CommandOrControl+Shift+R", () => {
    mainWindow?.webContents.send("live:hotkey-region")
  })
})

ipcMain.handle("live:unregister-hotkeys", () => {
  globalShortcut.unregister("CommandOrControl+Shift+T")
  globalShortcut.unregister("CommandOrControl+Shift+O")
  globalShortcut.unregister("CommandOrControl+Shift+R")
})

// ── Kill Hotkey ──

let currentKillHotkey = null

ipcMain.handle("register-kill-hotkey", (event, accelerator) => {
  // Unregister previous kill hotkey if any
  if (currentKillHotkey) {
    try { globalShortcut.unregister(currentKillHotkey) } catch {}
  }
  try {
    const ok = globalShortcut.register(accelerator, () => {
      console.log("[electron] Kill hotkey triggered:", accelerator)
      cleanup()
      app.quit()
    })
    if (ok) {
      currentKillHotkey = accelerator
      console.log("[electron] Kill hotkey registered:", accelerator)
    }
    return ok
  } catch (err) {
    console.error("[electron] Failed to register kill hotkey:", err.message)
    return false
  }
})

ipcMain.handle("unregister-kill-hotkey", () => {
  if (currentKillHotkey) {
    try { globalShortcut.unregister(currentKillHotkey) } catch {}
    currentKillHotkey = null
  }
})

// ── App Lifecycle ──

function cleanup() {
  // Close all game windows
  for (const [id, win] of gameWindows) {
    if (!win.isDestroyed()) win.close()
  }
  gameWindows.clear()

  // Close overlay and region select windows
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.close()
  if (regionSelectWindow && !regionSelectWindow.isDestroyed()) regionSelectWindow.close()
  overlayWindow = null
  regionSelectWindow = null

  // Stop auto capture
  if (autoCaptureInterval) {
    clearInterval(autoCaptureInterval)
    autoCaptureInterval = null
  }

  // Unregister hotkeys
  globalShortcut.unregisterAll()

  killProcess(backendProcess)
  killProcess(frontendProcess)
  // Fallback: kill orphaned processes by port (handles shell-spawned children)
  if (isDev) {
    killByPort(BACKEND_PORT)
    killByPort(frontendPort)
  }
  backendProcess = null
  frontendProcess = null
}

// ── OCR Language Pack Auto-Install ──

async function ensureOcrLanguagePacks() {
  const needed = ["ja", "en-US", "ko", "zh-Hans-CN"]

  try {
    // Single elevated PowerShell: check + install missing packs
    const script = `
      $needed = @(${needed.map((l) => `'${l}'`).join(",")})
      $missing = @()
      foreach ($lang in $needed) {
        $cap = Get-WindowsCapability -Online -Name "Language.OCR~~~$lang~0.0.1.0"
        if ($cap.State -ne 'Installed') { $missing += $lang }
      }
      if ($missing.Count -eq 0) { Write-Host 'ALL_INSTALLED'; exit 0 }
      foreach ($lang in $missing) {
        Write-Host "Installing OCR: $lang"
        Add-WindowsCapability -Online -Name "Language.OCR~~~$lang~0.0.1.0" | Out-Null
      }
      Write-Host 'INSTALL_DONE'
    `.replace(/\n/g, " ")

    const result = await new Promise((resolve, reject) => {
      const ps = spawn("powershell", [
        "-Command",
        `Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -Command ${script.replace(/'/g, "'''")}' -Verb RunAs -Wait`
      ], { stdio: "pipe" })
      let out = ""
      ps.stdout?.on("data", (d) => { out += d.toString() })
      ps.on("close", (code) => resolve({ code, out }))
      ps.on("error", (err) => reject(err))
    })

    console.log("[electron] OCR language pack result:", result.code, result.out.trim())
  } catch (err) {
    console.warn("[electron] OCR language pack install failed:", err.message)
  }
}

app.whenReady().then(async () => {
  if (process.platform === "darwin" && app.dock && fs.existsSync(APP_ICON_PNG)) {
    app.dock.setIcon(APP_ICON_PNG)
  }

  createWindow()

  await startBackend()
  await startFrontend()

  console.log("[electron] Waiting for servers...")
  try {
    await Promise.all([
      waitForHttp(`http://127.0.0.1:${BACKEND_PORT}/api/health`, "backend health", 30000),
      waitForHttp(
        isDev
          ? `http://127.0.0.1:${frontendPort}/_next/static/development/_buildManifest.js`
          : `http://127.0.0.1:${frontendPort}`,
        "frontend HTTP",
        30000
      ),
    ])
  } catch (err) {
    console.error("[electron] Server startup failed:", err.message)
    showStartupError("로컬 서버 준비 실패", err.message)
    setupAutoUpdater()
    return
  }

  console.log("[electron] Servers ready, opening window")
  await loadFrontendWindow()
  setupAutoUpdater()

  // Load kill hotkey from settings
  try {
    const res = await new Promise((resolve, reject) => {
      const req = http.get(`http://localhost:${BACKEND_PORT}/api/settings`, (resp) => {
        let data = ""
        resp.on("data", (chunk) => { data += chunk })
        resp.on("end", () => {
          try { resolve(JSON.parse(data)) } catch { resolve({}) }
        })
      })
      req.on("error", () => resolve({}))
      req.setTimeout(3000, () => { req.destroy(); resolve({}) })
    })
    const hotkey = res.hotkey_kill
    if (hotkey && typeof hotkey === "string") {
      const ok = globalShortcut.register(hotkey, () => {
        console.log("[electron] Kill hotkey triggered:", hotkey)
        cleanup()
        app.quit()
      })
      if (ok) {
        currentKillHotkey = hotkey
        console.log("[electron] Kill hotkey auto-registered:", hotkey)
      }
    }
  } catch (err) {
    console.warn("[electron] Failed to load kill hotkey from settings:", err.message)
  }
})

app.on("window-all-closed", () => {
  cleanup()
  app.quit()
})

app.on("before-quit", cleanup)
