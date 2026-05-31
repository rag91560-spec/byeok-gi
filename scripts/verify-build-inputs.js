const fs = require("fs")
const path = require("path")

const ROOT = path.join(__dirname, "..")
const checks = [
  ["installer icon", path.join(ROOT, "build", "icon.ico")],
  ["NSIS script", path.join(ROOT, "build", "installer.nsh")],
  [
    "ue-translator source",
    process.env.GT_UE_TRANSLATOR_DIR || path.resolve(ROOT, "..", "..", "ue-translator"),
  ],
  ["backend bundle", path.join(ROOT, "dist", "backend-dist")],
  ["frontend bundle", path.join(ROOT, "build-staging", "frontend")],
]

let failed = false
for (const [label, target] of checks) {
  if (!fs.existsSync(target)) {
    console.error(`[verify-build-inputs] Missing ${label}: ${target}`)
    failed = true
  }
}

if (failed) {
  console.error("[verify-build-inputs] Build inputs are incomplete; aborting package step.")
  process.exit(1)
}

console.log("[verify-build-inputs] OK")
