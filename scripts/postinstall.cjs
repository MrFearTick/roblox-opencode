#!/usr/bin/env node
/**
 * postinstall: copy commands to global OpenCode config.
 * Runs automatically after `opencode plugin roblox-opencode --global`.
 * Idempotent — skips if commands already exist.
 */
const fs = require("fs")
const path = require("path")
const os = require("os")

const srcDir = path.join(__dirname, "..", "commands")
const destDir = path.join(os.homedir(), ".config", "opencode", "commands")

if (!fs.existsSync(srcDir)) {
  // Not in a built package — skip silently (dev environment)
  process.exit(0)
}

fs.mkdirSync(destDir, { recursive: true })

const files = fs.readdirSync(srcDir).filter(f => f.endsWith(".md"))
let copied = 0

for (const file of files) {
  const dest = path.join(destDir, file)
  // Always overwrite — commands may be updated between versions
  fs.copyFileSync(path.join(srcDir, file), dest)
  copied++
}

if (copied > 0) {
  console.log(`roblox-opencode: installed ${copied} commands to ${destDir}`)
}
