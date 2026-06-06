/**
 * electron-builder afterPack hook.
 * Copies node_modules and .next that electron-builder's default filters exclude.
 */
const fs = require("fs")
const path = require("path")

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

function resolveResourcesDir(context) {
  if (context.electronPlatformName === "darwin") {
    const appName = `${context.packager.appInfo.productFilename}.app`
    return path.join(context.appOutDir, appName, "Contents", "Resources")
  }
  return path.join(context.appOutDir, "resources")
}

exports.default = async function afterPack(context) {
  const resourcesDir = resolveResourcesDir(context)
  const frontendSrc = path.join(__dirname, "..", "build-staging", "frontend")
  const frontendDest = path.join(resourcesDir, "frontend")

  // Copy node_modules (excluded by electron-builder default filters)
  const nmSrc = path.join(frontendSrc, "node_modules")
  const nmDest = path.join(frontendDest, "node_modules")
  if (fs.existsSync(nmSrc) && !fs.existsSync(nmDest)) {
    console.log("[afterPack] Copying frontend/node_modules...")
    copyRecursive(nmSrc, nmDest)
  }

  // Copy .next (dot-folder excluded by electron-builder default filters)
  const nextSrc = path.join(frontendSrc, ".next")
  const nextDest = path.join(frontendDest, ".next")
  if (fs.existsSync(nextSrc) && !fs.existsSync(nextDest)) {
    console.log("[afterPack] Copying frontend/.next...")
    copyRecursive(nextSrc, nextDest)
  }
}
