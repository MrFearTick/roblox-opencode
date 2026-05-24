---
description: "First-time Roblox project setup: skills, vendor libs, MCP, LSP, sync"
agent: build
---

# /setup-game

One-time project configuration for roblox-opencode. Run this when you first open a Roblox project.

Commands (`/init`, `/code-review`, etc.) are already available globally — installed when you ran `opencode plugin roblox-opencode`. This command sets up the *project*: skills, vendor libs, and tooling config.

---

## Step 1: Find the plugin directory

The plugin package is installed somewhere on disk. Find it:

```
# Check the OpenCode config for the plugin path
cat .opencode/opencode.json | grep -A2 plugin
```

If it's a relative path like `../roblox-opencode`, resolve it. If it's an npm package name, find it in `~/.config/opencode/node_modules/roblox-opencode/`.

## Step 2: Copy skills and vendor libs

From the plugin directory, copy:
- `skills/` → `.opencode/skills/` (12 skills)
- `vendor/` → `vendor/` in the project root (rbxutil, profilestore, promise, testez, t)

If the directories already exist, skip (idempotent).

## Step 3: Check prerequisites

Run these checks:

- `which luau-lsp` — needed for Luau diagnostics
- `which uvx` — needed for mcp-roblox-docs

If luau-lsp is missing: point user to https://github.com/JohnnyMorganz/luau-lsp/releases and guide install. If declined, note: "Reduced safety net. Install luau-lsp later and re-run /setup-game."

If uvx is missing: prompt "mcp-roblox-docs needs uv (Python package manager). Install it? (y/n)". If yes: `curl -LsSf https://astral.sh/uv/install.sh | sh`. If no: skip roblox-docs MCP server.

## Step 4: Write MCP config

Write to `opencode.json` (merge with existing):

```json
{
  "mcp": {
    "studio": {
      "type": "local",
      "command": ["npx", "-y", "@anthropic/studio-mcp"],
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

## Step 5: Write LSP config

Write to `opencode.json` (merge with existing):

```json
{
  "lsp": {
    "luau": {
      "command": ["luau-lsp", "--stdio"],
      "extensions": [".luau"]
    }
  }
}
```

## Step 6: Download globalTypes.d.luau

If luau-lsp is installed, download the pinned `globalTypes.d.luau` from the luau-lsp repo and place it in the project root. Configure `.luaurc` to reference it if needed.

## Step 7: Write core block to AGENTS.md

Read `core/roblox-core.md` from the roblox-opencode package directory.

Write it to the project's `./AGENTS.md` between managed markers:

```
<!-- roblox-opencode 1.0.0 BEGIN — managed block, edits inside will be overwritten -->
... content from core/roblox-core.md ...
<!-- roblox-opencode END -->
```

If AGENTS.md already has managed markers (roblox-opencode or old roblox-pi), replace the content between them. If AGENTS.md has content outside the markers, preserve it.

## Step 8: Sync setup + sentinel verification

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

## Step 9: Print the command tour

"roblox-opencode is ready. Here's what you can do:
- /init — bootstrap a new project or scan an existing one
- /code-review — review code with security/performance/monetization lenses
- /publish-checklist — pre-ship gauntlet before publishing to Roblox
- /debug — debugging helper for Luau/Roblox issues
- /diagnose — check if Script Sync is working properly

The harness is loaded. Prompt normally — the AI will suggest commands when relevant."
