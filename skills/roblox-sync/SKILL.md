---
name: roblox-sync
description: >
  Studio Script Sync setup walkthrough. Canonical sync path for roblox-pi.
  Sacrificial layer if Roblox swaps the feature.
last_reviewed: 2026-05-21
---

<!-- Source: Script Sync walkthrough compiled from Roblox DevForum + creator-docs (MIT) -->

# Studio Script Sync

## Why This Is the Canonical Sync Path

| Tool | Setup steps | TeamCreate | Project file required |
|------|-------------|------------|------------------------|
| Studio Script Sync | 2 (toggle + right-click) | Yes | No |
| Rojo | 6+ (install aftman, install Rojo, project.json, install plugin, serve, connect) | No | Yes |
| Argon | 5 (install CLI, install plugin, init project, serve, connect) | No | Yes |
| Pesto | 4 (install CLI, install plugin, init, sync) | Partial | Yes |

## Setup Walkthrough

1. In Roblox Studio, open **File → Beta Features**. Scroll to "Script Sync." Toggle it on. Restart Studio.
2. In Explorer, right-click the top-level container holding your scripts (commonly ServerScriptService, ReplicatedStorage, StarterPlayer → StarterPlayerScripts). Click **Start Sync**.
3. Pick a folder on disk. Suggested layout: `~/projects/<game-name>/src/<container-name>/`. Studio will mirror the script tree into that folder as `.luau` files.
4. Repeat for each top-level container that holds scripts. Sync auto-resumes when Studio restarts.

## Capacity

- Up to 10000 scripts per top-level instance
- Up to 128 top-level instances synced at once
- Two-way real-time sync. Edits in either direction propagate.

## What Sync Does and Doesn't

**Does:**
- Bidirectional `.luau` file mirror for scripts (Script, LocalScript, ModuleScript)
- Auto-resume on Studio restart
- Works with TeamCreate
- Surfaces errors in UI when sync fails

**Doesn't:**
- Sync non-script instances (Parts, Models, Folders without scripts)
- Sync empty folders (use `.gitkeep`)
- Sync PackageLink instance metadata (package script contents do sync)
- Provide sourcemaps (you still need Rojo for that)

## Mode Detection

Every session, the agent detects the active mode:

- **Sync Mode** (filesystem `.luau` files exist): read/write/edit via filesystem. MCP only for verification, playtest, scene ops, asset insertion. Never read a script via MCP if its file exists on disk.
- **MCP-Only Mode** (no `.luau` files on disk): minimize reads, prefer `run_code` for inspection, batch edits behind ChangeHistoryService Recording. Recommend enabling sync.

If MCP-only and project exceeds light-touch scope (>500 lines/module or >10 modules), proactively recommend Sync Mode before continuing.

## Common Issues

- **Sync silently stops after Studio update**: restart Studio + re-Start Sync.
- **Empty folders deleted on git pull**: add `.gitkeep`.
- **Sync errors not auto-detected**: restart Studio. Roblox is fixing this.
- **Duplicate-name hierarchy errors**: avoid duplicate names within a sync container.

## If User Already Has Rojo/Argon

Detect presence of `default.project.json` (Rojo) or `*.project.json` with Argon-specific fields. If found: filesystem is already source of truth, operate normally on disk. Don't suggest switching to Script Sync.
