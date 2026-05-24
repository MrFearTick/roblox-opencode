---
description: "First-time Roblox project setup: skills, vendor libs, LSP, sync"
agent: build
---

# /setup-game

One-time project configuration for roblox-opencode. Run this when you first open a Roblox project.

Commands (`/init`, `/diagnose`, etc.) are already available globally. Skills (`roblox-code-review`, `roblox-debug`, `roblox-publish-checklist`) are loaded on demand. This command sets up the *project*.

---

## Step 1: Run the setup tool

Call the `roblox_setup` tool. It handles:
- Copying 12 skills to `.opencode/skills/`
- Copying vendor libraries (rbxutil, profilestore, promise, testez, t) to `vendor/`
- Writing luau-lsp config to `opencode.json`
- Writing the core Roblox agent instructions to `AGENTS.md`

Report the results to the user. If any step failed, explain what went wrong and how to fix it.

## Step 2: Check prerequisites

Run these checks (cross-platform):

```bash
command -v luau-lsp   # needed for Luau diagnostics
```

If luau-lsp is missing: point user to https://github.com/JohnnyMorganz/luau-lsp/releases and guide install. If declined, note: "Reduced safety net. Install luau-lsp later and re-run /setup-game."

## Step 3: Download globalTypes.d.luau

If luau-lsp is installed, download the Roblox type definitions:

```bash
curl -fsSL https://luau-lsp.pages.dev/type-definitions/globalTypes.RobloxScriptSecurity.d.luau -o globalTypes.d.luau
```

This file provides Roblox API types to luau-lsp. The `--definitions` flag in the LSP config (from Step 1) points to it.

## Step 4: Enable Studio MCP

The Roblox Studio MCP server is built into Studio. To enable it:

1. Open Roblox Studio
2. Open Assistant (View → Assistant)
3. Click `…` → Manage MCP Servers
4. Turn on **Enable Studio as MCP server**

For opencode to connect, add this to your project's `opencode.json`:

**Windows:**
```json
{
  "mcp": {
    "studio": {
      "type": "local",
      "command": ["cmd.exe", "/c", "%LOCALAPPDATA%\\Roblox\\mcp.bat"],
      "enabled": true
    }
  }
}
```

**macOS:**
```json
{
  "mcp": {
    "studio": {
      "type": "local",
      "command": ["/Applications/RobloxStudio.app/Contents/MacOS/StudioMCP"],
      "enabled": true
    }
  }
}
```

After adding the config, restart opencode to connect.

## Step 5: Sync setup + sentinel verification

Hand off Script Sync setup to the user with these instructions:

"Enable Script Sync in Roblox Studio:
1. File → Beta Features → Script Sync → toggle on → restart Studio
2. In Explorer, right-click each top-level container with scripts (ServerScriptService, ReplicatedStorage, etc.) → Start Sync → pick a folder

Suggested folder layout: ~/projects/<game-name>/src/<container-name>/"

When the user confirms sync is enabled:

1. Write `_sync_check.luau` to the synced folder with content: `-- roblox-opencode sync verification sentinel`
2. Ask user: "Did `_sync_check.luau` appear in Studio's Explorer?"
3. If yes: clean up the sentinel file. Sync is confirmed.
4. If no: "Sync doesn't seem to be working. Check that you right-clicked the correct container and picked the right folder. Re-run /setup-game when ready."
5. Do NOT claim sync is working without this confirmation.

## Step 6: Print the command tour

"roblox-opencode is ready. Here's what you can do:

**Commands** (type `/` to use):
- /init — bootstrap a new project or scan an existing one
- /diagnose — check if Script Sync is working properly

**Skills** (AI suggests when relevant):
- roblox-code-review — review code with security/performance/monetization lenses
- roblox-debug — iterative debug loop for Luau/Roblox issues
- roblox-publish-checklist — pre-ship gauntlet before publishing

The harness is loaded. Prompt normally — the AI will suggest skills when relevant."
