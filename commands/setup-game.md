---
description: "First-time Roblox project setup: skills, vendor libs, MCP, LSP, sync"
agent: build
---

# /setup-game

One-time project configuration for roblox-opencode. Run this when you first open a Roblox project.

Commands (`/init`, `/code-review`, etc.) are already available globally. This command sets up the *project*.

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
command -v uvx        # needed for mcp-roblox-docs
```

If luau-lsp is missing: point user to https://github.com/JohnnyMorganz/luau-lsp/releases and guide install. If declined, note: "Reduced safety net. Install luau-lsp later and re-run /setup-game."

If uvx is missing: prompt "mcp-roblox-docs needs uv (Python package manager). Install it? (y/n)". If yes: `curl -LsSf https://astral.sh/uv/install.sh | sh`. If no: skip roblox-docs MCP server.

## Step 3: Download globalTypes.d.luau

If luau-lsp is installed, download the Roblox type definitions:

```bash
curl -fsSL https://luau-lsp.pages.dev/type-definitions/globalTypes.RobloxScriptSecurity.d.luau -o globalTypes.d.luau
```

This file provides Roblox API types to luau-lsp. The `--definitions` flag in the LSP config (from Step 1) points to it.

## Step 4: Write MCP config

Write to `opencode.json` (merge with existing). The Studio MCP server enables AI ↔ Studio communication:

```json
{
  "mcp": {
    "studio": {
      "type": "local",
      "command": ["npx", "-y", "@weppy/roblox-mcp"],
      "enabled": true
    }
  }
}
```

If uvx is available, also add:

```json
{
  "mcp": {
    "roblox-docs": {
      "type": "local",
      "command": ["uvx", "mcp-roblox-docs"],
      "enabled": true
    }
  }
}
```

Note to user: "Enable the Studio MCP server in Studio: open the Assistant widget (View → Assistant), click the MCP toggle. One click."

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
- /init — bootstrap a new project or scan an existing one
- /code-review — review code with security/performance/monetization lenses
- /publish-checklist — pre-ship gauntlet before publishing to Roblox
- /debug — debugging helper for Luau/Roblox issues
- /diagnose — check if Script Sync is working properly

The harness is loaded. Prompt normally — the AI will suggest commands when relevant."
