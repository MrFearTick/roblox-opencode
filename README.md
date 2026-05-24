# roblox-opencode

OpenCode plugin for Roblox/Luau development. Makes AI coding assistants competent at building Roblox games.

## Install

```
opencode plugin roblox-opencode
```

Then run `/setup-game` in your project to configure.

## What's included

**12 skills** (loaded on-demand by the AI):
- roblox-luau-mastery — Luau syntax, idioms, type system
- roblox-gui — UI layout, mobile-first design, reactive frameworks
- roblox-animation-vfx — Animation, particles, effects
- roblox-networking — Security hardening, validation, rate limiting
- roblox-data — ProfileStore, DataStores, persistence patterns
- roblox-testing — TestEZ, BDD patterns, test strategy
- roblox-tooling — Studio MCP, luau-lsp, diagnostics
- roblox-architecture — Service hierarchy, 7 foundational patterns
- roblox-runtime — RunService, StreamingEnabled, memory management
- roblox-sharp-edges — 12 production footguns by severity
- roblox-monetization — GamePasses, DevProducts, TOS compliance
- roblox-sync — Script Sync setup and troubleshooting

**6 commands:**
- `/setup-game` — One-time project config (MCP, LSP, core block, sync)
- `/init` — Bootstrap a new project or scan an existing one
- `/code-review` — Review with security/performance/monetization lenses
- `/publish-checklist` — Pre-ship verification gauntlet
- `/debug` — Iterative debug loop for Luau/Roblox issues
- `/diagnose` — Sync sanity check

**Vendor libraries** (auto-placed with mention):
- ProfileStore — Data persistence with session locking
- Trove — Cleanup/lifecycle management
- Signal — Typed custom signals (Sleitnick/RbxUtil)
- Promise — Async flow control (evaera)
- Comm — Typed client-server remotes (Sleitnick/RbxUtil)
- Component — CollectionService tag binding (Sleitnick/RbxUtil)
- t — Runtime type checking (osyrisrblx, recommended)
- TestEZ — BDD testing framework (Roblox, recommended)
- 25+ additional RbxUtil packages available on demand (see vendor/README.md)

## How it works

The plugin is a setup orchestrator. On install, it copies skills, commands, and vendor libs to your project, writes LSP and MCP config to `opencode.json`, and writes the core directives block to `AGENTS.md`.

After setup, the plugin is dormant. The 12 skills do all the work — the AI loads them on-demand based on what you're working on.

## Prerequisites

- [luau-lsp](https://github.com/JohnnyMorganz/luau-lsp) — Luau diagnostics (setup checks and guides install)
- [Roblox Studio](https://www.roblox.com/create) — With Script Sync enabled
- uv (optional) — For mcp-roblox-docs live API reference

## Update

```
opencode plugin roblox-opencode --force
```

Re-runs setup. Skills, commands, and config are overwritten. Content outside managed markers in AGENTS.md is preserved.

## License

MIT
