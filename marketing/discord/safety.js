function requireExecute(target) {
  const args = process.argv.slice(2)
  const confirmArg = args.find((arg) => arg.startsWith("--confirm="))
  const confirmedTarget = confirmArg ? confirmArg.slice("--confirm=".length) : ""

  if (!args.includes("--execute") || confirmedTarget !== target) {
    console.log(`[dry-run] ${target}`)
    console.log(`Add --execute --confirm=${target} to apply this external change.`)
    process.exit(0)
  }

  if (!process.env.DISCORD_TOKEN && target.includes("discord")) {
    console.error("DISCORD_TOKEN is required.")
    process.exit(1)
  }
}

module.exports = { requireExecute }
