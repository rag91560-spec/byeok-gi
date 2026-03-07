const { app, BrowserWindow, shell, ipcMain, dialog } = require("electron")
const path = require("path")
const { spawn, fork } = require("child_process")
const http = require("http")
const { autoUpdater } = require("electron-updater")

const isDev = !app.isPackaged
const ROOT = path.join(__dirname, "..")
const BACKEND_PORT = 8000
const FRONTEND_PORT = 3100

let mainWindow = null
let backendProcess = null
let frontendProcess = null
const gameWindows = new Map() // gameId -> BrowserWindow

// ── Helpers ──

function isPortInUse(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}`, () => resolve(true))
    req.on("error", () => resolve(false))
    req.end()
  })
}

function waitForServer(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      const req = http.get(`http://localhost:${port}`, () => resolve(true))
      req.on("error", () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Timeout waiting for port ${port}`))
        } else {
          setTimeout(check, 500)
        }
      })
      req.end()
    }
    check()
  })
}

function killProcess(proc) {
  if (!proc || proc.killed) return
  try {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(proc.pid), "/f", "/t"], {
        stdio: "ignore",
      })
    } else {
      proc.kill("SIGTERM")
    }
  } catch {}
}

let _cachedPython = null
function findPython() {
  if (_cachedPython) return _cachedPython
  const { execSync } = require("child_process")
  for (const cmd of ["python", "python3", "py"]) {
    try {
      execSync(`${cmd} --version`, { stdio: "ignore" })
      _cachedPython = cmd
      return cmd
    } catch {}
  }
  return null
}

// ── Server Management ──

async function startBackend() {
  if (await isPortInUse(BACKEND_PORT)) {
    console.log("[electron] Backend already running on port", BACKEND_PORT)
    return
  }
  console.log("[electron] Starting backend...")
  if (isDev) {
    const pythonCmd = findPython()
    if (!pythonCmd) {
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
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }
    )
  } else {
    // Production: run PyInstaller-built backend.exe
    const backendExe = path.join(process.resourcesPath, "backend-dist", "backend.exe")
    const dataDir = path.join(process.resourcesPath, "data")
    backendProcess = spawn(
      backendExe,
      [
        "--host", "127.0.0.1",
        "--port", String(BACKEND_PORT),
        "--data-dir", dataDir,
      ],
      {
        cwd: path.join(process.resourcesPath, "backend-dist"),
        stdio: ["ignore", "pipe", "pipe"],
      }
    )
  }
  backendProcess.stdout?.on("data", (d) => process.stdout.write(`[backend] ${d}`))
  backendProcess.stderr?.on("data", (d) => process.stderr.write(`[backend] ${d}`))
  backendProcess.on("error", (err) => console.error("[backend] Error:", err))
}

async function startFrontend() {
  if (await isPortInUse(FRONTEND_PORT)) {
    console.log("[electron] Frontend already running on port", FRONTEND_PORT)
    return
  }
  console.log("[electron] Starting frontend...")
  if (isDev) {
    frontendProcess = spawn(
      "npm", ["run", "dev", "--", "--port", String(FRONTEND_PORT)],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], shell: true }
    )
  } else {
    // Production: run Next.js standalone server
    const serverJs = path.join(process.resourcesPath, "frontend", "server.js")
    frontendProcess = fork(serverJs, [], {
      env: {
        ...process.env,
        PORT: String(FRONTEND_PORT),
        HOSTNAME: "localhost",
        NODE_ENV: "production",
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
    })
  }
  frontendProcess.stdout?.on("data", (d) => process.stdout.write(`[frontend] ${d}`))
  frontendProcess.stderr?.on("data", (d) => process.stderr.write(`[frontend] ${d}`))
  frontendProcess.on("error", (err) => console.error("[frontend] Error:", err))
}

// ── Window ──

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0c0c0f",
    show: false,
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

  mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`)

  // Show window when ready, with timeout fallback
  let shown = false
  const showOnce = () => {
    if (shown || !mainWindow) return
    shown = true
    mainWindow.show()
  }

  mainWindow.once("ready-to-show", showOnce)

  // Fallback: force show after 15s even if page fails to load
  setTimeout(showOnce, 15000)

  // Handle load failure — show error page instead of staying hidden
  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDesc, validatedURL) => {
    console.error(`[electron] Page load failed: ${errorCode} ${errorDesc} (${validatedURL})`)
    showOnce()
    mainWindow.webContents.loadURL(`data:text/html;charset=utf-8,
      <html><body style="background:#0c0c0f;color:#e0e0e0;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px">
        <h2>서버 시작 실패</h2>
        <p style="color:#888;font-size:14px">프론트엔드 서버에 연결할 수 없습니다 (${errorDesc})</p>
        <p style="color:#666;font-size:12px">Python이 설치되어 있는지 확인하고, 앱을 재시작해주세요.</p>
        <button onclick="location.href='http://localhost:${FRONTEND_PORT}'"
          style="margin-top:8px;padding:8px 20px;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">
          다시 시도
        </button>
      </body></html>
    `)
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
    if (url.startsWith("http")) {
      shell.openExternal(url)
      return { action: "deny" }
    }
    return { action: "allow" }
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

// ── Auto Update ──

autoUpdater.autoDownload = false
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

// APK file dialogs
ipcMain.handle("select-apk-file", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select APK files",
    filters: [{ name: "APK", extensions: ["apk"] }],
    properties: ["openFile", "multiSelections"],
  })
  return result.filePaths
})

ipcMain.handle("select-apk-folder", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select folder containing APK files",
    properties: ["openDirectory"],
  })
  return result.filePaths[0] || ""
})

// Subtitle/text file dialog
ipcMain.handle("select-subtitle-files", async () => {
  const result = await dialog.showOpenDialog({
    title: "Select subtitle/text files",
    filters: [{ name: "Subtitle", extensions: ["srt", "ass", "ssa", "vtt", "txt"] }],
    properties: ["openFile", "multiSelections"],
  })
  return result.filePaths
})

// HTML game window
ipcMain.handle("open-html-game", (event, { gameId, title, serveUrl }) => {
  const existing = gameWindows.get(gameId)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
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

// ── App Lifecycle ──

function cleanup() {
  // Close all game windows
  for (const [id, win] of gameWindows) {
    if (!win.isDestroyed()) win.close()
  }
  gameWindows.clear()

  killProcess(backendProcess)
  killProcess(frontendProcess)
  backendProcess = null
  frontendProcess = null
}

app.whenReady().then(async () => {
  await startBackend()
  await startFrontend()

  console.log("[electron] Waiting for servers...")
  try {
    await Promise.all([
      waitForServer(BACKEND_PORT, 30000),
      waitForServer(FRONTEND_PORT, 30000),
    ])
  } catch (err) {
    console.error("[electron] Server startup failed:", err.message)
    // Still create window to show error instead of silently quitting
    createWindow()
    setupAutoUpdater()
    return
  }

  console.log("[electron] Servers ready, opening window")
  createWindow()
  setupAutoUpdater()
})

app.on("window-all-closed", () => {
  cleanup()
  app.quit()
})

app.on("before-quit", cleanup)
