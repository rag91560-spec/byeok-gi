/**
 * Prepare Next.js standalone build for Electron packaging.
 * Copies .next/standalone + .next/static + public → build-staging/frontend/
 *
 * Next.js standalone output nests files under the project's absolute path.
 * We detect and flatten this so server.js lands at build-staging/frontend/server.js.
 */
const fs = require("fs")
const path = require("path")

const ROOT = path.join(__dirname, "..")
const STANDALONE = path.join(ROOT, ".next", "standalone")
const STATIC = path.join(ROOT, ".next", "static")
const PUBLIC = path.join(ROOT, "public")
const OUT = path.join(ROOT, "build-staging", "frontend")

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.copyFileSync(src, dest)
  }
}

/**
 * Find the actual project root inside standalone output.
 * Next.js nests it under the absolute path (e.g. standalone/Users/USER/Desktop/project/).
 * We find the directory containing server.js.
 */
function findServerRoot(dir) {
  // Check if server.js is directly here
  if (fs.existsSync(path.join(dir, "server.js"))) return dir

  // Search recursively (but skip node_modules)
  for (const entry of fs.readdirSync(dir)) {
    if (entry === "node_modules") continue
    const full = path.join(dir, entry)
    if (fs.statSync(full).isDirectory()) {
      const found = findServerRoot(full)
      if (found) return found
    }
  }
  return null
}

console.log("[prepare] Cleaning build-staging...")
if (fs.existsSync(OUT)) {
  fs.rmSync(OUT, { recursive: true, force: true })
}

// Detect nested project root
const serverRoot = findServerRoot(STANDALONE)
const SRC = serverRoot || STANDALONE

if (serverRoot && serverRoot !== STANDALONE) {
  console.log("[prepare] Detected nested standalone at:", path.relative(STANDALONE, serverRoot))
}

console.log("[prepare] Copying standalone output...")
copyRecursive(SRC, OUT)

console.log("[prepare] Copying static files...")
copyRecursive(STATIC, path.join(OUT, ".next", "static"))

console.log("[prepare] Copying public files...")
copyRecursive(PUBLIC, path.join(OUT, "public"))

// Verify server.js exists at expected location
if (fs.existsSync(path.join(OUT, "server.js"))) {
  console.log("[prepare] Done! server.js confirmed at build-staging/frontend/server.js")
} else {
  console.error("[prepare] WARNING: server.js not found at expected location!")
  process.exit(1)
}
