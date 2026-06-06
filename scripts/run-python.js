const fs = require("fs")
const path = require("path")
const { spawnSync } = require("child_process")

const ROOT = path.join(__dirname, "..")
const HOMEBREW_EXPAT_LIB = "/opt/homebrew/opt/expat/lib"

function pythonEnv() {
  const env = { ...process.env }
  if (process.platform === "darwin" && fs.existsSync(HOMEBREW_EXPAT_LIB)) {
    env.DYLD_LIBRARY_PATH = env.DYLD_LIBRARY_PATH
      ? `${HOMEBREW_EXPAT_LIB}${path.delimiter}${env.DYLD_LIBRARY_PATH}`
      : HOMEBREW_EXPAT_LIB
  }
  return env
}

function addCandidate(candidates, seen, command, args = []) {
  if (!command) return
  const key = `${command}\0${args.join("\0")}`
  if (seen.has(key)) return
  seen.add(key)
  candidates.push({ command, args })
}

function candidates() {
  const result = []
  const seen = new Set()
  addCandidate(result, seen, process.env.PYTHON)

  for (const localPath of [
    path.join(ROOT, ".venv312", "bin", "python"),
    path.join("/private", "tmp", "varo-backend-venv", "bin", "python"),
    path.join(ROOT, ".venv", "bin", "python"),
    path.join(ROOT, "venv", "bin", "python"),
  ]) {
    if (fs.existsSync(localPath)) addCandidate(result, seen, localPath)
  }

  if (process.platform === "win32") addCandidate(result, seen, "py", ["-3"])
  addCandidate(result, seen, "python3.12")
  addCandidate(result, seen, "python3.11")
  addCandidate(result, seen, "python3.10")
  addCandidate(result, seen, "python3")
  addCandidate(result, seen, "python")
  if (process.platform === "win32") addCandidate(result, seen, "py")

  return result
}

function findPython() {
  for (const candidate of candidates()) {
    const probe = spawnSync(
      candidate.command,
      [...candidate.args, "-c", "import sys; print(sys.executable)"],
      { encoding: "utf8", env: pythonEnv(), windowsHide: true }
    )
    if (probe.status === 0) {
      const executable = probe.stdout.trim().split(/\r?\n/)[0]
      if (executable) return { command: executable, args: [] }
    }
  }
  return null
}

const pythonArgs = process.argv.slice(2)
if (pythonArgs.length === 0) {
  console.error("[run-python] Usage: node scripts/run-python.js <script.py> [...args]")
  process.exit(2)
}

function pythonCanInstallPackages(candidate) {
  const probe = spawnSync(
    candidate.command,
    [
      ...candidate.args,
      "-c",
      "import pip, xmlrpc.client; print('pip-ready')",
    ],
    { encoding: "utf8", env: pythonEnv(), windowsHide: true }
  )
  return probe.status === 0
}

function pythonIsBackendBuildCompatible(candidate) {
  const probe = spawnSync(
    candidate.command,
    [
      ...candidate.args,
      "-c",
      "import sys; raise SystemExit(0 if (3, 10) <= sys.version_info[:2] < (3, 13) else 1)",
    ],
    { encoding: "utf8", env: pythonEnv(), windowsHide: true }
  )
  return probe.status === 0
}

function findBuildPython() {
  for (const candidate of candidates()) {
    const python = findPythonFromCandidate(candidate)
    if (python && pythonIsBackendBuildCompatible(candidate) && pythonCanInstallPackages(candidate)) return python
  }
  return null
}

function findPythonFromCandidate(candidate) {
  const probe = spawnSync(
    candidate.command,
    [...candidate.args, "-c", "import sys; print(sys.executable)"],
    { encoding: "utf8", env: pythonEnv(), windowsHide: true }
  )
  if (probe.status !== 0) return null
  const executable = probe.stdout.trim().split(/\r?\n/)[0]
  return executable ? { command: executable, args: [] } : null
}

const needsPackageInstall = pythonArgs[0]?.endsWith("build-backend.py")
const python = needsPackageInstall ? findBuildPython() : findPython()
if (!python) {
  if (needsPackageInstall) {
    console.error("[run-python] No build-compatible Python was found. Backend packaging requires Python 3.10, 3.11, or 3.12 with a working pip/xmlrpc stack.")
  } else {
    console.error("[run-python] Python 3 was not found. Install Python 3.10+ or set PYTHON=/path/to/python.")
  }
  process.exit(1)
}

console.log(`[run-python] Using ${python.command}`)
const run = spawnSync(python.command, [...python.args, ...pythonArgs], {
  cwd: ROOT,
  env: pythonEnv(),
  stdio: "inherit",
  windowsHide: true,
})

if (run.error) {
  console.error(`[run-python] Failed to run Python: ${run.error.message}`)
  process.exit(1)
}

process.exit(run.status ?? 1)
