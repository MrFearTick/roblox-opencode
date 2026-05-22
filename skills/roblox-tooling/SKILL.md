---
name: roblox-tooling
description: mcp-roblox-docs, Studio MCP, luau-lsp, tooling meta. API lookup directive.
last_reviewed: 2026-05-21
---

<!-- Source: brockmartin/roblox-game-skill (MIT) -->

# Roblox Tooling Ecosystem Reference

## 1. Overview

**Load this reference when:** setting up Rojo for filesystem-based development, configuring external tooling (linting, formatting, testing), building CI/CD pipelines, managing packages with Wally, or onboarding a team to professional Roblox workflows.

The modern Roblox development stack moves work out of Studio and into the filesystem, enabling version control, code review, automated testing, and all the practices expected in professional software engineering. The core toolchain is:

| Tool       | Purpose                        | Install Via        |
| ---------- | ------------------------------ | ------------------ |
| **Rojo**   | Filesystem <-> Studio sync     | Aftman / Cargo     |
| **Wally**  | Package manager                | Aftman / Cargo     |
| **Selene** | Luau linter                    | Aftman / Cargo     |
| **StyLua** | Luau/Lua formatter             | Aftman / Cargo     |
| **Lune**   | Luau runtime outside Roblox    | Aftman / Cargo     |
| **Aftman** | Toolchain manager (installs all above) | Cargo       |

---

## 2. Rojo

Rojo syncs a filesystem project into Roblox Studio (and back). It is the foundation of all external tooling workflows.

### Installation

```bash
# Option A — Aftman (recommended toolchain manager)
cargo install aftman          # one-time
aftman init                   # creates aftman.toml in project root
aftman add rojo-rbx/rojo      # pins a specific version

# Option B — Cargo directly
cargo install rojo

# Option C — GitHub releases / Foreman (legacy)
# Download binary from https://github.com/rojo-rbx/rojo/releases
```

After installing via Aftman, the `aftman.toml` pins tool versions for the project (e.g., `rojo = "rojo-rbx/rojo@7.4.4"`, `wally = "UpliftGames/wally@0.3.2"`). This ensures all contributors and CI use identical tool versions.

### File Naming Conventions

Rojo determines the Roblox class of each file by its suffix:

| File Name Pattern         | Roblox Class      | Example                         |
| ------------------------- | ----------------- | ------------------------------- |
| `*.server.luau`           | `Script`          | `main.server.luau`              |
| `*.client.luau`           | `LocalScript`     | `controller.client.luau`        |
| `*.luau` (no prefix)      | `ModuleScript`    | `Utils.luau`                    |
| `init.luau`               | Folder becomes a `ModuleScript` | `MyModule/init.luau` |
| `init.server.luau`        | Folder becomes a `Script`       | `GameService/init.server.luau` |
| `init.client.luau`        | Folder becomes a `LocalScript`  | `HUD/init.client.luau`         |
| `init.meta.json`          | Sets properties on the folder   | `MyFolder/init.meta.json`      |
| `*.model.json`            | Rojo model file   | `part.model.json`               |

> **Note:** `.lua` also works, but `.luau` is the modern standard and enables better LSP support.

### project.json — Complete Example

```json
{
  "name": "MyGame",
  "tree": {
    "$className": "DataModel",
    "ServerScriptService": {
      "$className": "ServerScriptService",
      "Server": { "$path": "src/server" }
    },
    "ServerStorage": {
      "$className": "ServerStorage",
      "Storage": { "$path": "src/server-storage" }
    },
    "ReplicatedStorage": {
      "$className": "ReplicatedStorage",
      "Shared": { "$path": "src/shared" },
      "Packages": { "$path": "Packages" }
    },
    "StarterPlayer": {
      "$className": "StarterPlayer",
      "StarterPlayerScripts": {
        "$className": "StarterPlayerScripts",
        "Client": { "$path": "src/client" }
      },
      "StarterCharacterScripts": {
        "$className": "StarterCharacterScripts",
        "Character": { "$path": "src/character" }
      }
    },
    "StarterGui": {
      "$className": "StarterGui",
      "UI": { "$path": "src/ui" }
    },
    "Workspace": {
      "$className": "Workspace",
      "$properties": { "FilteringEnabled": true }
    },
    "Lighting": {
      "$className": "Lighting",
      "$properties": { "Technology": "Future" }
    },
    "SoundService": { "$className": "SoundService" },
    "HttpService": {
      "$className": "HttpService",
      "$properties": { "HttpEnabled": true }
    }
  }
}
```

### Common Commands

```bash
# Initialize a new project
rojo init my-game

# Start the live sync server (default port 34872)
rojo serve

# Serve a specific project file
rojo serve default.project.json

# Build a .rbxlx place file from the project
rojo build -o game.rbxlx

# Build a .rbxl (binary format)
rojo build -o game.rbxl

# Build a model file
rojo build -o model.rbxm
```

### Two-Way Sync

Rojo supports two-way sync via the Studio plugin. When connected:

- Changes made on the filesystem are pushed into Studio in real time.
- Changes made inside Studio (e.g., moving parts, editing properties) can be pulled back to the filesystem when using `*.model.json` files or `init.meta.json`.
- Script content changes in Studio are synced back to `.luau` files.

> **Caveat:** Two-way sync for non-script instances is limited. For level design, most teams use a `.rbxlx` place file committed to Git and build/serve on top of it.

---

## 3. Wally — Package Manager

Wally is the community-standard package manager for Roblox, maintained by Uplift Games.

### wally.toml — Complete Example

```toml
[package]
name = "yourname/my-game"
version = "0.1.0"
registry = "https://github.com/UpliftGames/wally-index"
realm = "shared"
license = "MIT"
description = "My awesome Roblox game"
authors = ["Your Name <you@example.com>"]

[dependencies]
Promise = "evaera/promise@4.0.0"
Knit = "sleitnick/knit@1.6.0"
Signal = "sleitnick/signal@2.0.0"
Trove = "sleitnick/trove@1.1.0"
TableUtil = "sleitnick/table-util@1.2.0"
Timer = "sleitnick/timer@1.1.0"
Component = "sleitnick/component@2.4.0"
ProfileStore = "madstudioroblox/profileservice@1.2.0"

[server-dependencies]
DataStoreService = "sleitnick/datastore-service@0.1.0"

[dev-dependencies]
TestEZ = "roblox/testez@0.4.1"
```

### Realms

Wally uses **realms** to control where packages end up:

| Realm      | Destination             | Visible To          |
| ---------- | ----------------------- | ------------------- |
| `shared`   | `ReplicatedStorage`     | Server + Client     |
| `server`   | `ServerScriptService`   | Server only         |
| `dev`      | `ReplicatedStorage`     | Development only    |

### Common Commands

```bash
# Install all dependencies listed in wally.toml
wally install

# Search for a package
wally search promise

# Add a specific package (edits wally.toml)
# Note: manual editing of wally.toml is common

# Login for publishing
wally login

# Publish your own package
wally publish
```

After `wally install`, packages appear in a `Packages/` directory. Your `project.json` should map this directory into `ReplicatedStorage` (or another appropriate service).

### Popular Packages

| Package              | Author           | Purpose                                      |
| -------------------- | ---------------- | -------------------------------------------- |
| `evaera/promise`     | evaera           | Promise implementation for Luau              |
| `sleitnick/knit`     | sleitnick        | Lightweight service/controller framework     |
| `sleitnick/signal`   | sleitnick        | Custom signal (event) implementation         |
| `sleitnick/trove`    | sleitnick        | Cleanup/maid utility                         |
| `sleitnick/component`| sleitnick        | Component pattern for CollectionService tags |
| `madstudioroblox/profileservice` | madstudio | Robust DataStore wrapper             |
| `roblox/testez`      | Roblox           | BDD-style testing framework                  |
| `evaera/cmdr`        | evaera           | In-game admin command framework              |
| `Sleitnick/RbxUtil` | Sleitnick        | Signal, Trove, Comm, Component, etc.         |              |
| `sleitnick/table-util`| sleitnick       | Table utility functions                      |

### Publishing Your Own Packages

1. Set up your `wally.toml` with a unique `name` field: `"your-username/package-name"`.
2. Ensure `version` follows semver.
3. Include an `init.luau` at the package root that exports your module.
4. Run `wally login` to authenticate via GitHub.
5. Run `wally publish` to push to the Wally registry.

### Wally Package Sourcemap

After running `wally install`, generate a sourcemap so the Luau LSP can resolve package types:

```bash
rojo sourcemap default.project.json -o sourcemap.json
```

Some LSP configurations pick this up automatically.

---

## 4. Selene — Luau Linter

Selene is a static analysis tool for Lua and Luau. It catches bugs, style issues, and potential errors before runtime.

### Installation

```bash
aftman add Kampfkarren/selene
# or
cargo install selene
```

### selene.toml — Configuration

> **Config summary:** Sets `std = "roblox"` for Roblox globals, configures rules like `unused_variable = "warn"`, `undefined_variable = "deny"`, and `high_cyclomatic_complexity` (max 20). The AI agent can generate a `selene.toml` appropriate for any project's lint strictness level.

### Standard Library

The `std = "roblox"` setting tells Selene about all Roblox globals (`game`, `workspace`, `Instance`, etc.). Without it, every Roblox API call would trigger `undefined_variable`.

To generate a more precise standard library from your project's types:

```bash
selene generate-roblox-std
```

This creates a `roblox.yml` file with up-to-date API definitions.

### Common Commands

```bash
# Lint the entire src directory
selene src/

# Lint with specific config
selene --config selene.toml src/

# Generate Roblox standard library
selene generate-roblox-std

# Quiet output (only errors)
selene src/ --display-style quiet
```

### Inline Suppression

```lua
-- selene: allow(unused_variable)
local temporaryDebugValue = 42

local function example()
    -- selene: allow(shadowing)
    local x = 10
end
```

---

## 5. StyLua — Luau Formatter

StyLua is an opinionated code formatter for Lua and Luau, inspired by Prettier.

### Installation

```bash
aftman add JohnnyMorganz/StyLua
# or
cargo install stylua
```

### stylua.toml — Configuration

> **Config summary:** Controls column width (120), tab indentation (width 4), Unix line endings, double quotes, always-use call parentheses, and sorted requires. The AI agent can generate a `stylua.toml` matching any team's style preferences.

### Common Commands

```bash
# Format all Luau files in src/
stylua src/

# Check formatting without modifying (for CI)
stylua --check src/

# Format a single file
stylua src/server/PlayerService.luau

# Verify config
stylua --config-path stylua.toml --check src/
```

### VS Code Format-on-Save

Add StyLua as the default Luau formatter with format-on-save enabled in `.vscode/settings.json` (covered in the VS Code Setup section below).

### Ignoring Sections

```lua
-- stylua: ignore
local uglyButNecessaryMatrix = {
    { 1, 0, 0, 0 },
    { 0, 1, 0, 0 },
    { 0, 0, 1, 0 },
    { 0, 0, 0, 1 },
}
```

---

## 6. Git Workflows

### .gitignore — Key Patterns

> **Config summary:** Ignore `*.rbxl*`/`*.rbxm*` build artifacts, `Packages/` (Wally-installed), `sourcemap.json`, `roblox.yml`, OS/editor files, and `~/.aftman/`. Un-ignore `base.rbxlx` if using a committed place file. The AI agent can generate a complete `.gitignore` for any Roblox project.

### Branching Strategy

```
main (production — what's live in the game)
├── develop (integration branch)
│   ├── feature/combat-system
│   ├── feature/inventory-ui
│   ├── fix/respawn-bug
│   └── chore/update-packages
└── release/v1.2.0
```

- **Feature branches** for new gameplay systems.
- **Fix branches** for bug fixes.
- **Release branches** when preparing a deployment.
- Merge to `develop` via pull request with CI checks passing.
- Merge `develop` to `main` for releases.

### Team Create + Git Coexistence

For teams that use both Team Create (for level design) and Git (for code):

1. **Code** lives in the filesystem, synced via Rojo. Developers write code in VS Code and see changes in Studio via `rojo serve`.
2. **Level design / maps** are authored directly in Studio via Team Create.
3. To capture Studio changes in Git, periodically export the place file (`File > Save As > .rbxlx`) and commit it. Rojo builds on top of this base place.
4. Use a `base.rbxlx` that you DO commit (un-ignore in `.gitignore`) for non-code assets.

```bash
# Build flow with a base place file
rojo build default.project.json --output game.rbxlx --base base.rbxlx
```

---

## 7. VS Code Setup

### Recommended Extensions

| Extension                  | ID                                 | Purpose                        |
| -------------------------- | ---------------------------------- | ------------------------------ |
| **Luau LSP**               | `JohnnyMorganz.luau-lsp`           | Autocomplete, type checking, go-to-definition |
| **Rojo**                   | `evaera.vscode-rojo`               | Rojo integration in VS Code    |
| **Selene**                 | `Kampfkarren.selene-vscode`        | Inline lint warnings           |
| **StyLua**                 | `JohnnyMorganz.stylua`             | Format-on-save                 |
| **Roblox LSP** (alt)       | `Nightrains.robloxlsp`            | Alternative LSP (older)        |

### .vscode/settings.json

> **Config summary:** Enables Luau LSP sourcemap auto-generation, Roblox type definitions, diagnostics, and StyLua format-on-save with tabs. Hides `Packages/` and `sourcemap.json` from the file explorer. The AI agent can generate this file for any Roblox project.

### .vscode/extensions.json

> **Config summary:** Recommends Luau LSP, Rojo, Selene, and StyLua extensions for VS Code. The AI agent can generate this file for any Roblox project.

### Debugging Tips

- **Luau LSP shows red squiggles on Roblox APIs:** Ensure `luau-lsp.types.roblox` is `true` and the sourcemap is being generated. Run `rojo sourcemap default.project.json -o sourcemap.json` manually if auto-generation fails.
- **Packages not resolving:** After `wally install`, regenerate the sourcemap. The LSP reads `sourcemap.json` to understand the full tree.
- **Type errors on third-party packages:** Some Wally packages lack type annotations. Use `-- luau-lsp ignore` or add type stubs.
- **Rojo plugin not connecting:** Ensure `rojo serve` is running and Studio has the Rojo plugin installed (install via the Rojo VS Code extension or Roblox plugin marketplace).

---

## 8. CI/CD — GitHub Actions

### CI Workflow — `.github/workflows/ci.yml`

> **Config summary:** The CI pipeline runs 5 jobs: Selene lint, StyLua format check, Luau LSP type analysis, Lune tests, and a Rojo build check (after all others pass). Uses `ok-nick/setup-aftman@v0.4.2` for tool installation and `actions/upload-artifact@v4` for build artifacts. The AI agent can generate a project-specific CI workflow.

### CI Commands Summary

```bash
# Lint — exit code 1 on any warning/error
selene src/

# Format check — exit code 1 if any file is unformatted
stylua --check src/

# Build check — exit code 1 if project.json is invalid
rojo build default.project.json -o /dev/null

# Run tests via Lune
lune run tests/run
```

---

## 9. Lune Runtime

Lune is a standalone Luau runtime for running scripts outside of Roblox. It is ideal for testing, build scripts, code generation, and tooling.

### Installation

```bash
aftman add lune-org/lune
# or
cargo install lune
```

### Basic Usage

```bash
# Run a Luau script
lune run script-name           # runs script-name.luau from current dir or .lune/

# Run from a specific path
lune run path/to/script.luau
```

### Built-in Libraries

Lune provides globals that replace Roblox services for external scripting:

| Module | Purpose |
|--------|---------|
| `@lune/fs` | File system read/write |
| `@lune/net` | HTTP requests |
| `@lune/process` | Shell commands, environment |
| `@lune/stdio` | User prompts, terminal I/O |
| `@lune/task` | Timers and scheduling |

> The AI agent can generate Lune scripts using these modules for any build/test/tooling task.

### Test Runner Example

> **Config summary:** Lune test scripts (`tests/run.luau`) use `pcall`-based test runners with pass/fail reporting and `process.exit(1)` on failure. The AI agent can generate test runners and test files for any project.

### Lune for Build Scripts

> **Config summary:** Lune build scripts (`.lune/build.luau`) automate `wally install`, `rojo sourcemap`, and `rojo build` as a single `lune run build` command. The AI agent can generate project-specific build scripts.

---

## 10. Rojo Project Templates

### Solo Developer — Minimal Structure

```
my-game/
├── aftman.toml
├── default.project.json
├── wally.toml
├── selene.toml
├── stylua.toml
├── .gitignore
├── Packages/                  (git-ignored, populated by wally install)
├── src/
│   ├── server/
│   │   ├── Services/
│   │   │   ├── DataService.server.luau
│   │   │   └── GameService.server.luau
│   │   └── init.server.luau   (bootstrap — requires and starts services)
│   ├── client/
│   │   ├── Controllers/
│   │   │   ├── InputController.client.luau
│   │   │   └── UIController.client.luau
│   │   └── init.client.luau   (bootstrap — requires and starts controllers)
│   └── shared/
│       ├── Constants.luau
│       ├── Types.luau
│       └── Utils.luau
└── tests/
    └── run.luau
```

### Team Project — Full Structure

```
my-game/
├── .github/workflows/ci.yml
├── .vscode/settings.json, extensions.json
├── aftman.toml, default.project.json, wally.toml, wally.lock
├── selene.toml, stylua.toml, .gitignore, .luaurc
├── Packages/                  (git-ignored)
├── src/
│   ├── server/
│   │   ├── Services/{DataService,CombatService,MatchmakingService}/
│   │   │   └── (each: init.luau + sub-modules)
│   │   ├── Components/{Loot,NPC}.luau
│   │   └── init.server.luau
│   ├── client/
│   │   ├── Controllers/{Input,Camera,UI}Controller.luau
│   │   ├── Components/{Billboard,Interactable}.luau
│   │   ├── UI/Screens/{HUD,Inventory,Settings}.luau
│   │   └── init.client.luau
│   ├── character/{Animate,Health}.client.luau
│   ├── shared/
│   │   ├── Constants.luau, Types.luau, Enums.luau
│   │   ├── Utils/{Math,String,Table}.luau
│   │   └── Network/{Remotes,Middleware}.luau
│   ├── server-storage/{Maps,Assets}/
│   └── ui/Widgets/
├── tests/{run.luau, server/*.spec.luau, shared/*.spec.luau}
├── .lune/{build,deploy}.luau
├── assets/                    (raw assets: PSD, blend files, etc.)
└── docs/architecture.md
```

Key patterns: each service is a folder with `init.luau` + sub-modules; shared types/enums live in `src/shared/`; tests mirror `src/` structure.

### .luaurc for Path Aliases

> **Config summary:** `.luaurc` defines Luau path aliases (e.g., `"Shared" → "src/shared"`) so `require("@Shared/Utils")` works in both editor and Lune. The AI agent can generate an appropriate `.luaurc` based on the project's directory structure.

---

## 11. Best Practices

### Use External Tooling for Any Serious Project

- Even solo developers benefit from Rojo + Git. You get version history, the ability to roll back mistakes, and a professional code editor.
- The initial setup cost (30 minutes) pays for itself the first time you accidentally delete a script in Studio.

### Automate Quality Checks

- Run `selene` and `stylua --check` in CI on every pull request. This prevents lint regressions and formatting inconsistencies from ever reaching production.
- Add type checking via `luau-lsp analyze` in CI to catch type errors before they become runtime bugs.

### Version Control Everything

- All game code belongs in Git. No exceptions.
- Commit `wally.lock` for reproducible builds (so every team member and CI gets the same package versions).
- Commit `aftman.toml` so every contributor uses the same tool versions.
- Tag releases with semver (`v1.0.0`, `v1.1.0`) so you can always identify what's deployed.

### Lock Tool Versions

- Use Aftman to pin exact versions of Rojo, Wally, Selene, StyLua, and Lune. This prevents "works on my machine" issues.

### Structure Code by Domain

- Organize `src/server/Services/` by game system, not by script type.
- Each service folder should be self-contained with its own `init.luau`.
- Shared types and constants go in `src/shared/` where both server and client can access them.

### Write Tests

- Use Lune for unit tests on pure logic (math, data transformations, state machines).
- Use TestEZ for integration tests that run inside Studio.
- Even minimal test coverage on critical systems (data saving, economy) prevents costly bugs.

---

## 12. Anti-Patterns

### Studio-Only Development Without Backups

**Problem:** All code lives exclusively inside a Roblox place file. If the file corrupts, Studio crashes, or you accidentally delete a script, the work is gone. Roblox auto-saves are not a reliable backup strategy.

**Fix:** Use Rojo to keep code on the filesystem and commit to Git. Even a basic `git init` + `git commit` cycle provides infinite undo.

### Manual Formatting

**Problem:** Every developer uses different indentation, quote styles, and line lengths. Code reviews waste time on style nitpicks. Merges produce unnecessary diff noise.

**Fix:** Add `stylua.toml` to the project, enable format-on-save, and run `stylua --check` in CI. Formatting becomes invisible and automatic.

### No Linting

**Problem:** Typos in variable names, unused variables, and incorrect API usage are only caught at runtime (if at all). Developers waste time debugging errors that a linter would catch instantly.

**Fix:** Add `selene.toml` with `std = "roblox"` and run it in CI. Start with default rules and tighten over time.

### Committing Packages/ to Git

**Problem:** The `Packages/` directory contains third-party code installed by Wally. Committing it bloats the repository, creates noisy diffs on updates, and duplicates what the registry already provides.

**Fix:** Add `Packages/` to `.gitignore`. Run `wally install` as part of your setup and CI scripts. Commit `wally.lock` for reproducibility.

### Committing Build Artifacts

**Problem:** `.rbxl` and `.rbxlx` files are large binaries that change on every build. Committing them inflates repository size and makes Git operations slow.

**Fix:** Add `*.rbxl` and `*.rbxlx` to `.gitignore`. Build from source in CI. If you need a base place file for non-code assets, commit exactly one `base.rbxlx` and keep it updated intentionally.

### Not Using Type Annotations

**Problem:** Luau has a powerful type system, but many developers ignore it. Without types, refactoring is risky, autocomplete is limited, and bugs slip through.

**Fix:** Annotate function signatures, especially on public module APIs. Use `--!strict` at the top of critical modules. Run `luau-lsp analyze` in CI.

### Ignoring Wally Lock Files

**Problem:** Without committing `wally.lock`, different developers (and CI) may resolve to different package versions, causing subtle and hard-to-diagnose inconsistencies.

**Fix:** Commit `wally.lock`. Run `wally install` (which respects the lock file) rather than manually editing versions.

### Monolithic Scripts

**Problem:** A single 2,000-line server script that handles combat, data, matchmaking, and UI updates. Impossible to test, review, or maintain.

**Fix:** Split into focused services/modules. Each module should do one thing. Use `init.luau` folders to group related files. Aim for files under 300 lines.

---

## MCP Orchestration

## Overview

Load this reference whenever performing any of the following:

- **MCP operations** — executing Luau code, reading/writing instances, managing assets via MCP tools
- **Autonomous building** — scaffolding game structure, generating systems, iterating on builds
- **Debugging via Studio** — reading console output, tracing errors, applying fixes in-place
- **Project exploration** — understanding an existing place file's architecture and script layout

This reference defines how Claude detects, selects, and orchestrates MCP tools to drive Roblox Studio directly.

---

## MCP Detection

On every session start or when Studio interaction is requested, detect which MCP server is available by probing for characteristic tool names.

### Community Server (boshyxd/robloxstudio-mcp)

**Detect by looking for these tools:** `execute_luau`, `get_file_tree`, `grep_scripts`, `create_build`, `search_objects`, `get_instance_properties`, `get_script_source`

If any of these tools are present, operate in **Full Mode** (39 tools).

### Official Server (Roblox/studio-rust-mcp-server)

**Detect by looking for these tools:** `run_code`, `insert_model`, `get_console_output`, `start_stop_play`, `run_script_in_play_mode`, `get_studio_mode`

If these tools are present but community tools are not, operate in **Standard Mode** (6 tools).

### No MCP Tools Detected

If neither server's tools are available, operate in **Offline Mode** — generate copy-paste Luau code and filesystem structures instead.

### Detection Priority

If both servers are detected, prefer the **Community Server** for its broader toolset. Fall back to individual Official Server tools only when a community equivalent is unavailable or failing.

---

## Full Mode (Community Server — 39 Tools)

### Exploration

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `get_file_tree` | Returns the full instance hierarchy of the place | First step in any project exploration; understanding overall structure |
| `get_project_structure` | Returns a higher-level structural overview | Quick orientation before diving into specifics |
| `search_objects` | Find instances by name or class across the tree | Locating specific parts, models, scripts, or UI elements |
| `get_instance_properties` | Read all properties of a specific instance | Inspecting configuration, checking values before modification |
| `get_instance_children` | List direct children of an instance | Navigating the hierarchy incrementally |
| `grep_scripts` | Search across all scripts for a pattern | Finding references, tracing function calls, locating bugs |
| `get_script_source` | Read the full source of a specific script | Understanding implementation before editing |
| `search_by_property` | Find instances matching a property value | Locating all anchored parts, all red-colored bricks, etc. |
| `get_class_info` | Get Roblox API info for a class | Checking available properties/methods before writing code |
| `get_selection` | Get the currently selected instance(s) in Studio | Context-aware operations on what the user has selected |

### Building

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `execute_luau` | Run arbitrary Luau code inside Studio | The primary workhorse — create instances, modify properties, run any logic |
| `create_build` | Generate a structured build from a specification | Scaffolding rooms, maps, or complex instance trees from a plan |
| `import_build` | Import a previously exported build | Restoring saved structures or applying templates |
| `export_build` | Export a subtree to a reusable format | Saving work for reuse, creating templates, backing up before changes |
| `import_scene` | Import a complete scene definition | Loading pre-built environments or level layouts |

### Testing

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `start_playtest` | Begin a playtest session in Studio | Validating changes, testing gameplay, triggering runtime behavior |
| `stop_playtest` | End the current playtest session | After gathering output or when done testing |
| `get_playtest_output` | Read console/output from the playtest | Checking for errors, reading print statements, validating behavior |

### Assets (Creator Store)

| Tool | Purpose | When to Use |
|------|---------|-------------|
| Creator Store `search` | Search the Creator Store for models, audio, etc. | Finding assets to populate a scene |
| Creator Store `details` | Get metadata for a specific asset | Checking asset info before insertion |
| Creator Store `thumbnail` | Get the thumbnail/preview image of an asset | Visual verification before inserting |
| Creator Store `insert` | Insert an asset from the Creator Store into the place | Adding models, meshes, audio, images, etc. |
| Creator Store `preview` | Preview an asset before committing to insertion | Evaluating suitability |

### History

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `undo` | Undo the last change via ChangeHistoryService | Rolling back a mistake, reverting after a failed experiment |
| `redo` | Redo a previously undone change | Re-applying a reverted change |

### Bulk Operations

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `mass_get_property` | Read a property from many instances at once | Auditing values across the place (e.g., all part sizes) |
| Batch operations | Execute multiple related changes in sequence | Bulk renaming, bulk property updates, mass restructuring |

---

## Standard Mode (Official Server — 6 Tools)

When only the official Roblox MCP server is available, operate with this reduced but capable toolset.

| Tool | Purpose | Notes |
|------|---------|-------|
| `run_code` | Execute Lua/Luau code inside Studio | Equivalent to `execute_luau` — primary workhorse |
| `insert_model` | Insert a model from the Creator Store | Takes an asset ID; inserts into Workspace by default |
| `get_console_output` | Read Studio's output/console log | Use for error detection and debug loops |
| `start_stop_play` | Toggle playtest mode on/off | Single tool handles both start and stop |
| `run_script_in_play_mode` | Execute code during an active playtest | Automatically stops the playtest when the script finishes |
| `get_studio_mode` | Check whether Studio is in Edit or Play mode | Always call before mode-sensitive operations |

### Standard Mode Workflow Adaptations

Since Standard Mode lacks exploration tools (`get_file_tree`, `grep_scripts`, etc.), compensate by using `run_code` with scripts that traverse the DataModel and return structure as printed output, then read results via `get_console_output`. Build instance-search logic inline via `run_code` instead of relying on `search_objects`.

---

## Offline Mode

When no MCP server is connected, generate self-contained Luau code blocks that the user can copy-paste into Studio manually.

### Script Output Format

Always include clear placement instructions (target service, script type) in a comment header. For Rojo users, output a directory structure instead of placement comments. Include `default.project.json` mapping when creating new projects.

### Offline Conventions

- Label every script block with its target service/folder
- Use `ModuleScript`, `Script`, or `LocalScript` type annotations
- Group related scripts together with a section header
- Provide a setup checklist at the end listing manual steps (e.g., "Create a RemoteEvent named 'DamageEvent' in ReplicatedStorage")

---

## Orchestration Patterns

### Autonomous Build

A full build cycle from specification to working game systems:

1. **SCAFFOLD** — `get_file_tree` / `get_project_structure` → understand current state → plan hierarchy → `create_build` / `execute_luau` to create folder structure
2. **GENERATE CORE SYSTEMS** — For each system: `execute_luau` to create Script, LocalScript, ModuleScript instances; wire up RemoteEvents/Functions
3. **INSERT ASSETS** — Search Creator Store for models/audio → insert and position in scene
4. **TEST** — `start_playtest` → `get_playtest_output` → `stop_playtest`
5. **FIX & ITERATE** — `grep_scripts` → `get_script_source` → `execute_luau` to fix → return to step 4 (max 5 iterations)

### Debug Loop

Systematic error resolution with bounded retries (max 5 iterations):

1. **DETECT** — `get_console_output` / `get_playtest_output` → capture errors; parse for script name, line, error type
2. **LOCATE** — `grep_scripts` with error keywords → `get_script_source` for the identified script → analyze root cause
3. **FIX** — Generate corrected code → `execute_luau` to replace script source (create undo waypoint first)
4. **VERIFY** — `start_playtest` → `get_playtest_output` → check if error persists → `stop_playtest`
5. **ITERATE** — If error persists and attempts < 5 → return to step 2; if resolved → report success; if attempts ≥ 5 → report findings

### Bulk Modification

Safe large-scale changes across many instances:

1. **SEARCH** — `search_objects` / `search_by_property` → identify targets; `mass_get_property` → audit current values
2. **PLAN** — Review affected instances, confirm correctness, create undo waypoint via `ChangeHistoryService:SetWaypoint()`
3. **EXECUTE** — `execute_luau` with loop over all targets; batch if count > 100
4. **VERIFY** — `mass_get_property` → confirm new values; spot-check via `get_instance_properties`

### Project Exploration

Understanding an unfamiliar place file:

1. **STRUCTURE** — `get_file_tree` → full hierarchy; `get_project_structure` → high-level layout
2. **SCRIPTS** — Identify all scripts via `search_objects`; `get_script_source` for key scripts; `grep_scripts` for `require`, `RemoteEvent`, `BindableEvent`
3. **ARCHITECTURE** — Map module dependencies, client-server communication (RemoteEvents/Functions), and data flow (DataStores, player data)
4. **REPORT** — Summarize services used, script count, system architecture, potential issues

---

## Safety Guidelines

### Pre-Operation Checks

1. **Check Studio mode** before any operation — call `get_studio_mode` (Official) or infer from context (Community). Do not execute build code while a playtest is active.
2. **Create undo waypoints** before any bulk or destructive operation:
   ```lua
   game:GetService("ChangeHistoryService"):SetWaypoint("Before: <description>")
   ```
3. **Read before write** — always inspect a script's current source before overwriting it.
4. **Verify instance existence** before modifying — check that the target path resolves to a real instance.

### Destructive Operation Safeguards

- **Deleting instances**: Always confirm with the user before calling `:Destroy()` on named or significant instances. Deleting anonymous/temporary parts is fine without confirmation.
- **Overwriting scripts**: Log the previous source (or at least its length and key function names) before replacing.
- **Clearing containers**: Never call `:ClearAllChildren()` on services (Workspace, ServerScriptService, etc.) without explicit user confirmation.

### Playtest Safety

- Do not run `execute_luau` / `run_code` to modify the DataModel while a playtest is active — changes will be lost when the playtest ends.
- Use `run_script_in_play_mode` (Official) for runtime testing during play mode.
- Always `stop_playtest` before applying fixes discovered during testing.

---

## Best Practices

- **Batch operations:** Group related reads/writes in a single `execute_luau` call to minimize round-trips.
- **Read before write:** Always `get_script_source` before modifying; apply targeted changes, not blind overwrites.
- **Verify after modify:** After `execute_luau`, confirm with `get_instance_properties` or `start_playtest`.
- **Undo waypoints:** Create `ChangeHistoryService:SetWaypoint()` before batches, experimental changes, or anything the user might want to undo as a unit.

---

## Anti-Patterns

| Anti-Pattern | Fix |
|---|---|
| Running code without checking Studio state | Always call `get_studio_mode` first; don't modify DataModel during playtest |
| Bulk changes without undo points | Set `ChangeHistoryService:SetWaypoint()` before any bulk or destructive operation |
| Assuming tool availability | Detect which MCP server is connected; fall back to `run_code` + `get_console_output` in Standard Mode |
| Blind script overwrites | Always `get_script_source` first; merge new logic with existing code or confirm full replacement with user |
| Ignoring error output | Always check return values/`; if error, enter the Debug Loop pattern (max 5 iterations) |
