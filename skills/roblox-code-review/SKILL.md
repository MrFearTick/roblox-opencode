---
name: roblox-code-review
description: "Code review with security, performance, and monetization lenses for Roblox projects"
tags: [roblox, code-review, security, performance, monetization]
---

# /code-review — Code Quality Review

You are performing a code quality review on a Roblox project. Follow these 8 steps. Apply the relevant lens based on what changed. Don't apply all lenses every time.

---

## Step 1: Project Scan

Read the project directory structure. Survey script count, naming patterns, and organization.

Record:
- Total script count
- Folder organization
- Module naming patterns
- Whether the project uses Rojo/Wally or in-Studio editing

---

## Step 2: Organization Review

Check:
- Scripts in correct locations (ServerScriptService, StarterPlayerScripts, etc.)
- Proper use of services vs standalone scripts
- Clean folder structure (no orphaned scripts, no nesting > 3 levels deep)
- Module naming conventions consistent (PascalCase for ModuleScripts, camelCase for functions)
- No scripts with duplicate or overlapping responsibilities

---

## Step 3: Code Quality Scan

Search for anti-patterns:

```
Deprecated APIs:
- wait( → replace with task.wait()
- spawn( → replace with task.spawn()
- delay( → replace with task.delay()

Code smells:
- Global variables (should be module-scoped)
- Missing type annotations on public functions
- Instance.new() in client scripts (should be server-created)
- while true without task.wait() (unbounded loops)
```

Check for:
- Deprecated APIs (`wait()`, `spawn()`, `delay()`)
- Global variable usage (should be module-scoped)
- Missing type annotations on public functions
- Inconsistent naming conventions
- Dead code / unreachable code
- Duplicate code across scripts
- Overly long functions (>100 lines, should be refactored)

---

## Step 4: Architecture Review

Check:
- Module boundaries — Does each module have a single responsibility?
- Dependency direction — Do modules depend on abstractions, not concrete implementations?
- Circular requires — Any modules that depend on each other?
- Separation of concerns — Server vs Client logic properly separated
- Framework usage — If using a framework, is it used consistently?
- Configuration — Hardcoded values should be in config modules

---

## Step 5: Security Quick-Check

Quick scan for:
- Unvalidated RemoteEvent handlers (server-side)
- Client-trusted logic (currency, inventory, damage, position)
- Sensitive data in ReplicatedStorage or StarterPlayer
- Missing rate limiting on remotes
- ProcessReceipt implementation correctness

> **For a deep security review, run the Security Lens below.**

---

## Step 6: Performance Quick-Check

Quick scan for:
- `wait()` or `spawn()` in tight loops
- Multiple `RunService.Heartbeat:Connect()` in same script
- Large tables without cleanup
- Undisconnected events (memory leaks)
- Unanchored parts without collision groups
- Excessive RemoteEvent usage

> **For a deep performance review, run the Performance Lens below.**

---

## Step 7: Quality Report

Rate overall quality:

- **A** — Production-ready. Clean, organized, secure, performant
- **B** — Solid with minor issues. Safe to ship with minor cleanup
- **C** — Functional but needs work. Ship with caveats
- **D** — Significant issues. Needs refactoring before ship
- **F** — Critical problems. Do not ship in current state

List findings by severity:
- **Critical** — Security vulnerabilities, data loss risk, crashes
- **High** — Memory leaks, performance bottlenecks, broken features
- **Medium** — Code smells, deprecated APIs, poor organization
- **Low** — Style inconsistencies, missing documentation

For each finding, provide:
1. File and line (or function name)
2. What's wrong
3. The specific fix (code)

---

## Step 8: Refactoring Suggestions

If significant issues found, suggest refactoring priorities:

1. **Immediate** — Must fix before next publish
2. **Short-term** — Fix in the next development cycle
3. **Long-term** — Plan for when the project grows

For each suggestion:
- What to change
- Why it matters
- Estimated effort (small/medium/large)

---

# Security Lens

*Apply this lens when security-relevant code changed: remotes, data persistence, monetization, player input handling, or server authority.*

---

## Security Step 1: Remote Surface Scan

Search for all `RemoteEvent` and `RemoteFunction` instances. Search for `:FireServer`, `:FireClient`, `:InvokeServer`, `:InvokeClient` to map the full remote surface.

Record every remote found with:
- Name
- Location (ReplicatedStorage path)
- Direction (Client→Server, Server→Client, Client↔Server)
- What it appears to do

---

## Security Step 2: Validation Check

For each remote, verify:
- **Argument type checking** — Server validates `typeof(arg)` for every parameter
- **Range validation** — Numeric inputs checked against min/max bounds
- **Cooldown enforcement** — Rate limiting prevents spam/exploitation
- **Authorization check** — Server verifies the requesting player owns the action
- **Sanitization** — String inputs cleaned, no injection vectors

Flag any remote that accepts input without full server-side validation.

---

## Security Step 3: Client Trust Audit

Search for client-side logic that should be server-side:
- Currency operations (giving/removing coins, cash, gems)
- Inventory changes (adding/removing items)
- Damage calculation (should be server-authoritative)
- Position setting (teleporting, movement authority)
- Leaderboard/stat modification
- Game state changes (win/lose conditions)

**Rule:** If it affects game state or other players, it must be server-validated.

---

## Security Step 4: Data Exposure Check

Verify:
- No sensitive data in `ReplicatedStorage` (secrets, configs with admin keys)
- No server-only logic in `StarterPlayerScripts` (game state, anti-cheat)
- No player data exposed to other players via remotes (unless intentional)
- RemoteEvent payloads don't include excess data (send only what's needed)
- No `require()` paths to server-only modules from client scripts

---

## Security Step 5: Rate Limiting Check

Verify all remotes have per-player rate limiting:
- Track last-fire timestamps server-side
- Reject requests faster than expected human input
- Different limits for different actions (chat: 1/sec, purchase: 1/5sec, movement: 30/sec)
- Log rate limit violations for monitoring

---

## Security Step 6: Vulnerability Report

Categorize findings:

- **Critical** — Exploitable for direct advantage (free currency, item duplication, account takeover)
- **High** — Data exposure or corruption possible
- **Medium** — Potential for abuse with moderate effort
- **Low** — Best practice violation, hard to exploit

For each vulnerability:
1. Remote/method affected
2. Exploit scenario (how an attacker would abuse it)
3. Impact (what they gain)
4. Fix (specific hardened code)

---

## Security Step 7: Hardening

Apply hardened code for each vulnerable remote. Include before/after for clarity.

Hardening patterns to apply:
- Server-side validation wrapper for each remote
- Rate limiting middleware
- Data sanitization functions
- Ownership verification for state changes

---

## Security Step 8: Re-verify

Confirm all vulnerabilities addressed:
- Each Critical/High finding has a corresponding fix applied
- Legitimate functionality still works after hardening
- No new issues introduced by the fixes
- Output a before/after comparison of the security posture

---

# Performance Lens

*Apply this lens when performance-sensitive code changed: large loops, data structures, rendering, network-heavy features, or when the user reports lag.*

---

## Performance Step 1: Project Scan

Search for known anti-patterns:
- `wait()` and `spawn()` (yield-based, blocks thread)
- `RunService` loops (Heartbeat, Stepped, RenderStepped frequency)
- `GetDescendants()` and `GetChildren()` in loops (expensive at scale)

---

## Performance Step 2: Part Audit

Check for:
- Total part count (target: <50,000 for mobile, <200,000 for PC)
- Unanchored parts without assembly (physics chaos)
- Parts without collision groups (unnecessary collision detection)
- MeshParts vs Unions vs parts (MeshParts are most efficient)
- Transparent/reflective parts (rendering cost)

---

## Performance Step 3: Script Audit

Check for:
- Multiple `Heartbeat:Connect()` in the same script (consolidate into one)
- Excessive RemoteEvent usage (batch updates, reduce frequency)
- Tight loops without `task.wait()` (thread starvation)
- Unindexed table operations (linear search vs hash lookup)
- String concatenation in loops (use table.concat instead)
- `Instance.new()` in hot paths (cache and reuse)
- Deep `WaitForChild()` chains (cache references)

---

## Performance Step 4: Memory Audit

Check for:
- Undisconnected events (every `:Connect()` must have a matching `:Disconnect()`)
- Unreferenced instances (created but never parented or referenced)
- Large data tables held in memory (use lazy loading)
- String/internment issues (unnecessary duplicate strings)
- Module-level state that grows without cleanup

---

## Performance Step 5: Network Audit

Check:
- RemoteEvent frequency — Are updates sent every frame when 1/sec would suffice?
- Data size per event — Are payloads unnecessarily large?
- Unnecessary replication — Is data sent to all players when only some need it?
- `FireAllClients` vs `FireClient` — Target specific players when possible
- Debouncing — Are rapid-fire remotes properly debounced server-side?

---

## Performance Step 6: Priority Report

Generate prioritized list:

- **Critical** — Causes crashes or completely unplayable experience
- **High** — Noticeable lag, frame drops, or rubber-banding
- **Medium** — Suboptimal but functional, wasted resources
- **Low** — Minor optimization opportunity

For each item:
1. What's slow
2. Why it's slow (technical explanation)
3. The fix (specific code change)
4. Expected improvement

---

## Performance Step 7: Apply Fixes

Provide optimized code for each finding. Include before/after with expected impact.

Common fixes:
- Replace `wait()` with `task.wait()`
- Consolidate Heartbeat connections
- Add `task.wait()` to prevent thread starvation
- Cache `GetService()` calls
- Use spatial indexing for distance checks
- Batch RemoteEvent updates

---

## Performance Step 8: Before/After

Document improvements:
1. **Metric** — What was measured (frame time, memory, network traffic)
2. **Before** — Original value
3. **After** — Improved value
4. **Change** — Percentage improvement
5. **Remaining** — What's left to optimize

---

# Monetization Lens

*Apply this lens when monetization code changed: GamePasses, DevProducts, Premium integration, shop UI, or when reviewing revenue strategy.*

---

## Monetization Step 1: Current State

Search for `MarketplaceService` usage. Find all GamePass and DevProduct references. List all existing monetization.

Record:
- All GamePasses (ID, name, price, what it grants)
- All DevProducts (ID, name, price, what it consumes)
- Premium benefits (if any)
- Where monetization is presented in-game

---

## Monetization Step 2: GamePass Review

Evaluate each GamePass:
- Is the value clear to the player?
- Is the price appropriate for what it grants?
- Is it discoverable in-game (shown at relevant moments)?
- Does it persist correctly (works after rejoin)?
- Is it idempotent (purchasing twice doesn't break anything)?
- Does it provide lasting value vs one-time use?

---

## Monetization Step 3: DevProduct Review

Evaluate each consumable:
- Is it compelling enough for repeat purchase?
- Is it priced for impulse buy (<100 Robux) or considered purchase?
- Does ProcessReceipt handle correctly (grant then confirm)?
- Are there diminishing returns or purchase limits?
- Is the value clear before purchasing?
- Does it complement (not replace) gameplay?

---

## Monetization Step 4: Missing Opportunities

Based on genre best practices, suggest monetization the game is missing.

**Simulator:** VIP GamePass (2x currency, exclusive pets), Auto-farm DevProduct, Lucky egg/spin DevProducts, Season pass.

**Tycoon:** VIP GamePass (faster income, exclusive materials), Extra plot slots, Cosmetic upgrades.

**RPG:** Inventory expansion, Experience boosts, Cosmetic gear, Character slots.

**Horror:** Skip/co-op passes, Cosmetic items (flashlight skins, outfits), Hint system DevProduct.

**Battle Royale:** Battle pass (seasonal), Cosmetic-only items, Victory animations.

---

## Monetization Step 5: Pricing Analysis

Compare prices against Roblox norms:
- **Entry point** — 25-49 Robux for impulse buys
- **Mid-tier** — 99-199 Robux for meaningful upgrades
- **Premium** — 499-999 Robux for VIP/lifetime benefits
- **Consumables** — 10-50 Robux for repeat purchases

Evaluate Robux-to-value ratio, price anchoring, and bundle discounts.

---

## Monetization Step 6: Premium Integration

Check:
- Premium payouts configured and optimized
- Premium-exclusive benefits (10-15% bonus, exclusive items, priority queue)
- Premium benefits clearly communicated to non-Premium players
- Premium doesn't create unfair advantages in competitive games

---

## Monetization Step 7: Ad Integration

Evaluate if Rewarded Video Ads would fit:
- Natural placement points (extra life, bonus currency, skip wait timer)
- Player opt-in only (never forced)
- Doesn't interrupt core gameplay loop
- Frequency capped (1 ad per X minutes)
- Value exchange is fair (ad view = meaningful reward)

---

## Monetization Step 8: Ethical Review

Flag potentially predatory patterns:
- Loot boxes / gambling mechanics — Are odds disclosed?
- FOMO pressure — Limited-time offers that pressure quick decisions?
- Pay-to-win — Can paying players dominate free players unfairly?
- Dark patterns — Confusing UI that leads to accidental purchases?

---

## Monetization Step 9: Recommendations Report

Prioritized list of monetization improvements:

- **Must-have** — Items that directly increase revenue
- **Should-have** — Items that improve conversion or retention
- **Nice-to-have** — Items that optimize existing revenue

For each recommendation:
1. What to implement
2. Why it will increase revenue
3. Implementation effort (small/medium/large)
4. Where in the game to present it
5. Pricing suggestion