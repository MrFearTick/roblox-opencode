# /setup

Orchestrates the roblox-pi environment. Idempotent. Re-runnable. Self-updating.

Run this after `pi install npm:roblox-pi`. Follow each step in order. If any optional step fails, skip it with a note and continue.

---

## Step 1: Install extension stack

Run these `pi install` commands:

```
pi install npm:pi-mcp-adapter
pi install npm:pi-hashline-edit
pi install npm:pi-bar
pi install npm:@juicesharp/rpiv-ask-user-question
pi install npm:context-mode
pi install npm:pi-plan
pi install npm:pi-context-prune
```

If any individual install fails, note it and continue with the rest. `pi-mcp-adapter` is the only truly mandatory one.

## Step 2: Configure pi-context-prune

Add to `~/.pi/agent/settings.json` or `.pi/settings.json`:

```json
{
  "pi-context-prune": {
    "enabled": true,
    "pruneOn": "agent-message",
    "summarizerModel": "default"
  }
}
```

## Step 3: Check for uvx

Run `which uvx`. If not found:

- Prompt user: "mcp-roblox-docs needs uv (Python package manager). Install it? (y/n)"
- If yes: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- If no: skip mcp-roblox-docs. Note: "Reduced docs lookup capability. You can install uv later and re-run /setup."

## Step 4: Register mcp-roblox-docs (if uvx available)

Add to MCP config via pi-mcp-adapter:

```json
{
  "mcpServers": {
    "roblox-docs": {
      "command": "uvx",
      "args": ["mcp-roblox-docs"]
    }
  }
}
```

## Step 5: Register built-in Studio MCP

Add to MCP config:

```json
{
  "mcpServers": {
    "roblox-studio": {
      "command": "...",
      "args": ["--studio-mcp"]
    }
  }
}
```

Note to user: "Enable the Studio MCP server in Studio: open the Assistant widget (View → Assistant), click the MCP toggle. One click."

## Step 6: Check for luau-lsp

Run `which luau-lsp`. If not found:

- Point user to: https://github.com/JohnnyMorganz/luau-lsp/releases
- Guide install based on their OS (brew install, GitHub releases, or cargo install)
- If declined: skip diagnostics. Note: "Reduced safety net. Install luau-lsp later and re-run /setup."

If found:

- Download pinned `globalTypes.d.luau` from the luau-lsp repo
- Configure luau-lsp to use it (`.luaurc` or command-line flag)

## Step 7: Write core block to AGENTS.md

Read `core/roblox-core.md` from the roblox-pi package.

Write it to the project's `./AGENTS.md` between managed markers:

```
<!-- roblox-pi 0.1.0 BEGIN — managed block, edits inside will be overwritten -->
... content from core/roblox-core.md ...
<!-- roblox-pi END -->
```

If AGENTS.md already has a managed block (markers exist), replace the content between them. If AGENTS.md doesn't exist, create it. If AGENTS.md has content outside the markers, preserve it.

## Step 8: Reload

Run `/reload` to pick up the new extensions and AGENTS.md.

If `/reload` doesn't work mid-session, tell the user: "Restart Pi to pick up the new extensions."

## Step 9: Sync setup + sentinel verification

Hand off Script Sync setup to the user with these instructions:

"Enable Script Sync in Roblox Studio:
1. File → Beta Features → Script Sync → toggle on → restart Studio
2. In Explorer, right-click each top-level container with scripts (ServerScriptService, ReplicatedStorage, etc.) → Start Sync → pick a folder

Suggested folder layout: ~/projects/<game-name>/src/<container-name>/"

When the user confirms sync is enabled:

1. Write `_pi_sync_check.luau` to the synced folder with content: `-- roblox-pi sync verification sentinel`
2. Ask user: "Did `_pi_sync_check.luau` appear in Studio's Explorer?"
3. If yes: clean up the sentinel file. Sync is confirmed.
4. If no: "Sync doesn't seem to be working. Check that you right-clicked the correct container and picked the right folder. Re-run /setup when ready."
5. Do NOT claim sync is working without this confirmation.

## Step 10: Index project with context-mode

Run `ctx_index` on the project directory. This enables project-wide search for future sessions.

## Step 11: Print the slash-command tour

"roblox-pi is ready. Here's what you can do:
- /init — bootstrap a new project or scan an existing one
- /code-review — review code with security/performance/monetization lenses
- /publish-checklist — pre-ship gauntlet before publishing to Roblox
- /debug — debugging helper for Luau/Roblox issues
- /diagnose — check if Script Sync is working properly
- /plan — toggle read-only planning mode

The harness is loaded. Prompt normally — the AI will suggest commands when relevant."
