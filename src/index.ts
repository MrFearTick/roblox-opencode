import type { Plugin } from "@opencode-ai/plugin"
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "fs"
import { join, dirname } from "path"

const VERSION = "1.0.0"
const MARKER_BEGIN = `<!-- roblox-opencode ${VERSION} BEGIN — managed block, edits inside will be overwritten -->`
const MARKER_END = "<!-- roblox-opencode END -->"

export const RobloxOpenCode: Plugin = async ({ directory, client }) => {
  const pkgDir = dirname(new URL(import.meta.url).pathname.replace("/src", ""))
  const projectDir = directory

  client.app.log.info(`roblox-opencode v${VERSION} loaded`)

  // Check if AGENTS.md has current version markers
  const agentsPath = join(projectDir, "AGENTS.md")
  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, "utf-8")
    const hasCurrentMarkers = content.includes(MARKER_BEGIN)
    const hasOldMarkers = content.includes("<!-- roblox-opencode") && !hasCurrentMarkers

    if (hasOldMarkers) {
      client.app.log.warn("roblox-opencode AGENTS.md markers are outdated. Run /setup to update.")
    } else if (!hasCurrentMarkers && !content.includes("<!-- roblox-pi")) {
      // No markers at all — first time
      client.app.log.info("roblox-opencode not configured yet. Run /setup to initialize.")
    }
  } else {
    client.app.log.info("No AGENTS.md found. Run /setup to initialize roblox-opencode.")
  }

  return {
    "session.created": async () => {
      // On session start, check if setup has been run
      const skillsDir = join(projectDir, ".opencode", "skills")
      if (!existsSync(skillsDir)) {
        client.app.log.info("roblox-opencode skills not installed. Run /setup to initialize.")
      }
    },
  }
}

/**
 * Setup orchestrator — copies files, writes config, initializes the project.
 * Called by the /setup command.
 */
export async function runSetup(directory: string) {
  const pkgDir = dirname(new URL(import.meta.url).pathname.replace("/src", ""))
  const projectDir = directory

  const steps: { name: string; fn: () => void }[] = []

  // Step 1: Copy skills
  steps.push({
    name: "Copy skills to .opencode/skills/",
    fn: () => {
      const src = join(pkgDir, "skills")
      const dest = join(projectDir, ".opencode", "skills")
      mkdirSync(dest, { recursive: true })
      cpSync(src, dest, { recursive: true })
    },
  })

  // Step 2: Copy commands
  steps.push({
    name: "Copy commands to .opencode/commands/",
    fn: () => {
      const src = join(pkgDir, "commands")
      const dest = join(projectDir, ".opencode", "commands")
      mkdirSync(dest, { recursive: true })
      cpSync(src, dest, { recursive: true })
    },
  })

  // Step 3: Copy vendor libs
  steps.push({
    name: "Copy vendor libraries to project",
    fn: () => {
      const src = join(pkgDir, "vendor")
      const dest = join(projectDir, "vendor")
      mkdirSync(dest, { recursive: true })
      cpSync(src, dest, { recursive: true })
    },
  })

  // Step 4: Write LSP config to opencode.json
  steps.push({
    name: "Write LSP config (luau-lsp)",
    fn: () => {
      const configPath = join(projectDir, "opencode.json")
      let config: Record<string, unknown> = {}
      if (existsSync(configPath)) {
        try {
          config = JSON.parse(readFileSync(configPath, "utf-8"))
        } catch {
          // Corrupted config, start fresh
        }
      }

      config.lsp = {
        ...(config.lsp as Record<string, unknown> || {}),
        luau: {
          command: ["luau-lsp", "--stdio"],
          extensions: [".luau"],
        },
      }

      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n")
    },
  })

  // Step 5: Write core block to AGENTS.md
  steps.push({
    name: "Write core block to AGENTS.md",
    fn: () => {
      const corePath = join(pkgDir, "core", "roblox-core.md")
      const coreContent = readFileSync(corePath, "utf-8")

      const block = `${MARKER_BEGIN}\n${coreContent}\n${MARKER_END}`

      let agentsContent = ""
      if (existsSync(agentsPath)) {
        agentsContent = readFileSync(agentsPath, "utf-8")
      }

      if (agentsContent.includes("<!-- roblox-opencode") || agentsContent.includes("<!-- roblox-pi")) {
        // Replace existing managed block
        const beginPattern = /<!-- roblox-opencode[^>]*BEGIN[^>]*-->/
        const endPattern = /<!-- roblox-opencode END -->/

        // Also handle old roblox-pi markers
        const oldBeginPattern = /<!-- roblox-pi[^>]*BEGIN[^>]*-->/
        const oldEndPattern = /<!-- roblox-pi END -->/

        let newContent = agentsContent

        if (beginPattern.test(newContent) && endPattern.test(newContent)) {
          newContent = newContent.replace(
            new RegExp(`${beginPattern.source}[\\s\\S]*?${endPattern.source}`),
            block
          )
        } else if (oldBeginPattern.test(newContent) && oldEndPattern.test(newContent)) {
          newContent = newContent.replace(
            new RegExp(`${oldBeginPattern.source}[\\s\\S]*?${oldEndPattern.source}`),
            block
          )
        } else {
          // Markers in content but regex didn't match — append
          newContent = newContent.trimEnd() + "\n\n" + block + "\n"
        }

        writeFileSync(agentsPath, newContent)
      } else {
        // No existing markers — create or append
        const content = agentsContent
          ? agentsContent.trimEnd() + "\n\n" + block + "\n"
          : block + "\n"
        writeFileSync(agentsPath, content)
      }
    },
  })

  // Execute all steps
  const results: { step: string; status: "ok" | "error"; error?: string }[] = []

  for (const step of steps) {
    try {
      step.fn()
      results.push({ step: step.name, status: "ok" })
    } catch (err) {
      results.push({
        step: step.name,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return results
}

/**
 * Write MCP config to opencode.json. Called by /setup after checking prerequisites.
 */
export function writeMcpConfig(
  directory: string,
  servers: { studio?: boolean; robloxDocs?: boolean }
) {
  const configPath = join(directory, "opencode.json")
  let config: Record<string, unknown> = {}
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"))
    } catch {
      // corrupted, start fresh
    }
  }

  const mcp: Record<string, unknown> = {}

  if (servers.studio) {
    mcp.studio = {
      type: "local",
      command: ["npx", "-y", "@anthropic/studio-mcp"],
      enabled: true,
    }
  }

  if (servers.robloxDocs) {
    mcp["roblox-docs"] = {
      type: "local",
      command: ["uvx", "mcp-roblox-docs"],
      enabled: true,
    }
  }

  config.mcp = { ...(config.mcp as Record<string, unknown> || {}), ...mcp }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n")
}

export default RobloxOpenCode
