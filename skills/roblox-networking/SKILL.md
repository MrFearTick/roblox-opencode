---
name: roblox-networking
description: >
  Remotes, validation, exploit literacy, rate limiting, server-authoritative networking,
  security hardening.
last_reviewed: 2026-05-21
---

<!-- Source: brockmartin/roblox-game-skill (MIT) -->

# Roblox Multiplayer & Networking Reference

---

## 1. Overview

**Load this reference when:**

- Designing multiplayer game loops (rounds, lobbies, arenas)
- Implementing matchmaking or queue systems
- Building cross-server features (global chat, trading, server browsing)
- Working with TeleportService for multi-place games
- Creating team-based gameplay
- Managing player lifecycles in a multiplayer context
- Setting up private/reserved servers

This document covers player management, team systems, lobby implementation, round-based game loops, TeleportService, MessagingService, matchmaking, server instance management, and production best practices for multiplayer Roblox games.

---

## 2. Player Management

### Players Service

The `Players` service is the root of all player-related functionality. Every connected player is represented by a `Player` instance that lives as a child of `Players`.

```luau
local Players = game:GetService("Players")

-- Current player count
local count = #Players:GetPlayers()

-- Server capacity
local maxPlayers = Players.MaxPlayers

-- Iterate all connected players
for _, player in Players:GetPlayers() do
    print(player.Name, player.UserId)
end
```

### PlayerAdded / PlayerRemoving

These are the two most important events for multiplayer games. They fire on the server when a player joins or leaves.

```luau
-- ServerScriptService/PlayerManager.luau

local Players = game:GetService("Players")

local function onPlayerAdded(player: Player)
    -- Load saved data
    -- Initialize player state (score, team assignment, inventory)
    -- Grant starter gear
    -- Teleport to lobby spawn
    print(`{player.Name} joined (UserId: {player.UserId})`)
end

local function onPlayerRemoving(player: Player)
    -- Save player data (CRITICAL: do this before the player object is destroyed)
    -- Clean up any per-player state tables
    -- Notify other players
    -- Update team balance
    print(`{player.Name} leaving`)
end

Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(onPlayerRemoving)

-- Handle players who joined before this script ran (studio edge case)
for _, player in Players:GetPlayers() do
    task.spawn(onPlayerAdded, player)
end
```

**Critical rule:** Always handle `PlayerRemoving` to save data. The player object and its descendants are destroyed shortly after this event fires. If you yield too long (e.g., a slow DataStore call), you risk losing the save. Use `game:BindToClose()` as a fallback for server shutdowns.

### CharacterAdded / CharacterRemoving

Each player's character is a `Model` in `Workspace` that contains the `Humanoid`, body parts, and accessories. Characters are created and destroyed on respawn.

```luau
local function onCharacterAdded(character: Model)
    local humanoid = character:WaitForChild("Humanoid")
    local rootPart = character:WaitForChild("HumanoidRootPart")

    -- Set custom health
    humanoid.MaxHealth = 150
    humanoid.Health = 150

    -- Listen for death
    humanoid.Died:Connect(function()
        -- Award kill to attacker, update scoreboard, etc.
    end)
end

player.CharacterAdded:Connect(onCharacterAdded)
```

### LoadCharacter (Manual Respawning)

By default, Roblox auto-spawns characters. For round-based games, disable auto-spawn and control it manually:

```luau
-- In StarterPlayer properties: set CharacterAutoLoads = false
-- Or set it in script:
Players.CharacterAutoLoads = false

-- Spawn a specific player
player:LoadCharacter()

-- Spawn all players
for _, player in Players:GetPlayers() do
    task.spawn(function()
        player:LoadCharacter()
    end)
end
```

### Player Instance Lifecycle

Understanding the lifecycle prevents common bugs:

1. `PlayerAdded` fires -- Player instance exists, no character yet.
2. `CharacterAdded` fires -- Character model is parented to Workspace.
3. `CharacterRemoving` fires -- Character is about to be destroyed (death or manual removal).
4. `CharacterAdded` fires again -- Respawn.
5. `PlayerRemoving` fires -- Player is disconnecting. Character may or may not exist.

**Gotcha:** `player.Character` can be `nil` at any point. Always nil-check before accessing it.

---

## 3. Team Systems

### Teams Service

The `Teams` service holds `Team` objects. Teams are automatically replicated to all clients and show up in the default leaderboard.

```luau
local Teams = game:GetService("Teams")

-- Create teams programmatically (or place them in Studio under Teams)
local redTeam = Instance.new("Team")
redTeam.Name = "Red"
redTeam.TeamColor = BrickColor.new("Bright red")
redTeam.AutoAssignable = false -- Don't auto-assign players
redTeam.Parent = Teams

local blueTeam = Instance.new("Team")
blueTeam.Name = "Blue"
blueTeam.TeamColor = BrickColor.new("Bright blue")
blueTeam.AutoAssignable = false
blueTeam.Parent = Teams

local lobbyTeam = Instance.new("Team")
lobbyTeam.Name = "Lobby"
lobbyTeam.TeamColor = BrickColor.new("Medium stone grey")
lobbyTeam.AutoAssignable = true -- New players go here
lobbyTeam.Parent = Teams
```

### Assigning Players to Teams

```luau
-- Direct assignment
player.Team = redTeam

-- The player's nametag, leaderboard entry, and spawn location
-- all update automatically based on TeamColor.

-- Get all players on a team
local redPlayers = redTeam:GetPlayers()
print(`Red team has {#redPlayers} players`)
```

### Team-Based Logic

Always check teams on the **server** before applying damage or other competitive interactions:

```luau
local function canDamage(attacker: Player, victim: Player): boolean
    -- No friendly fire
    if attacker.Team == victim.Team then
        return false
    end

    -- No damaging lobby players
    if victim.Team == lobbyTeam then
        return false
    end

    return true
end

-- In a weapon hit handler (server-side)
local function onWeaponHit(attacker: Player, victimCharacter: Model)
    local victim = Players:GetPlayerFromCharacter(victimCharacter)
    if not victim then return end

    if not canDamage(attacker, victim) then return end

    local humanoid = victimCharacter:FindFirstChild("Humanoid")
    if humanoid then
        humanoid:TakeDamage(25)
    end
end
```

### Auto-Balancing Teams

```luau
local function getSmallestTeam(teamList: {Team}): Team
    local smallest = teamList[1]
    local smallestCount = #smallest:GetPlayers()

    for i = 2, #teamList do
        local count = #teamList[i]:GetPlayers()
        if count < smallestCount then
            smallest = teamList[i]
            smallestCount = count
        end
    end

    return smallest
end

-- Assign player to the team with fewer members
local function assignToBalancedTeam(player: Player)
    player.Team = getSmallestTeam({ redTeam, blueTeam })
end
```

---

## 4. Lobby System

A lobby holds players in a waiting area until enough are ready to start a round. This implementation tracks ready states, shows a ready-up GUI, enforces a minimum player threshold, and auto-starts after a timeout.

### Server-Side Lobby Manager

```luau
-- ServerScriptService/LobbyManager.luau

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local LobbyRemotes = Instance.new("Folder")
LobbyRemotes.Name = "LobbyRemotes"
LobbyRemotes.Parent = ReplicatedStorage

local ReadyUpEvent = Instance.new("RemoteEvent")
ReadyUpEvent.Name = "ReadyUp"
ReadyUpEvent.Parent = LobbyRemotes

local LobbyStatusEvent = Instance.new("RemoteEvent")
LobbyStatusEvent.Name = "LobbyStatus"
LobbyStatusEvent.Parent = LobbyRemotes

-- Configuration
local MIN_PLAYERS = 2
local MAX_WAIT_TIME = 60 -- seconds to auto-start after minimum reached
local COUNTDOWN_DURATION = 10 -- final countdown before round starts

-- State
local readyPlayers: { [Player]: boolean } = {}
local lobbyActive = true
local countdownRunning = false

local function getReadyCount(): number
    local count = 0
    for player, isReady in readyPlayers do
        -- Verify the player is still connected
        if isReady and player.Parent == Players then
            count += 1
        end
    end
    return count
end

local function getTotalPlayers(): number
    return #Players:GetPlayers()
end

local function broadcastStatus(message: string, countdown: number?)
    for _, player in Players:GetPlayers() do
        LobbyStatusEvent:FireClient(player, message, countdown, getReadyCount(), getTotalPlayers())
    end
end

local function shouldStart(): boolean
    return getTotalPlayers() >= MIN_PLAYERS and getReadyCount() >= MIN_PLAYERS
end

local function startCountdown()
    if countdownRunning then return end
    countdownRunning = true

    for i = COUNTDOWN_DURATION, 1, -1 do
        if not lobbyActive then
            countdownRunning = false
            return
        end

        -- Recheck player count (someone may have left)
        if getTotalPlayers() < MIN_PLAYERS then
            broadcastStatus("Not enough players. Waiting...", nil)
            countdownRunning = false
            return
        end

        broadcastStatus(`Round starting in {i}...`, i)
        task.wait(1)
    end

    countdownRunning = false
    lobbyActive = false
    broadcastStatus("Round starting!", 0)

    -- Signal to round manager (see Section 5)
    local RoundManager = require(script.Parent:WaitForChild("RoundManager"))
    RoundManager.startRound()
end

-- Handle ready-up toggle
ReadyUpEvent.OnServerEvent:Connect(function(player: Player)
    if not lobbyActive then return end

    readyPlayers[player] = not readyPlayers[player]
    broadcastStatus(
        if readyPlayers[player] then `{player.Name} is ready!` else `{player.Name} unreadied.`,
        nil
    )

    if shouldStart() and not countdownRunning then
        task.spawn(startCountdown)
    end
end)

-- Clean up when players leave
Players.PlayerRemoving:Connect(function(player: Player)
    readyPlayers[player] = nil

    if lobbyActive then
        broadcastStatus(`{player.Name} left the lobby.`, nil)
    end
end)

-- Auto-start timer: once minimum players are present, start a background timer
task.spawn(function()
    local waitElapsed = 0
    while lobbyActive do
        task.wait(1)
        if getTotalPlayers() >= MIN_PLAYERS then
            waitElapsed += 1
            if waitElapsed >= MAX_WAIT_TIME and not countdownRunning then
                -- Force all present players to ready
                for _, player in Players:GetPlayers() do
                    readyPlayers[player] = true
                end
                task.spawn(startCountdown)
            end
        else
            waitElapsed = 0
        end
    end
end)

-- Public API for reset
local LobbyManager = {}

function LobbyManager.reset()
    readyPlayers = {}
    lobbyActive = true
    countdownRunning = false
    broadcastStatus("Lobby open. Ready up!", nil)
end

return LobbyManager
```

### Client-Side Ready-Up GUI

```luau
-- StarterPlayerScripts/LobbyGui.client.luau

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")
local lobbyRemotes = ReplicatedStorage:WaitForChild("LobbyRemotes")
local readyUpEvent = lobbyRemotes:WaitForChild("ReadyUp")
local lobbyStatusEvent = lobbyRemotes:WaitForChild("LobbyStatus")

-- Build GUI
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "LobbyGui"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

local frame = Instance.new("Frame")
frame.Size = UDim2.fromScale(0.3, 0.15)
frame.Position = UDim2.fromScale(0.35, 0.8)
frame.BackgroundColor3 = Color3.fromRGB(30, 30, 30)
frame.BackgroundTransparency = 0.3
frame.Parent = screenGui

local uiCorner = Instance.new("UICorner")
uiCorner.CornerRadius = UDim.new(0, 12)
uiCorner.Parent = frame

local statusLabel = Instance.new("TextLabel")
statusLabel.Size = UDim2.fromScale(1, 0.5)
statusLabel.BackgroundTransparency = 1
statusLabel.TextColor3 = Color3.new(1, 1, 1)
statusLabel.TextScaled = true
statusLabel.Text = "Waiting for players..."
statusLabel.Parent = frame

local readyButton = Instance.new("TextButton")
readyButton.Size = UDim2.fromScale(0.6, 0.4)
readyButton.Position = UDim2.fromScale(0.2, 0.55)
readyButton.BackgroundColor3 = Color3.fromRGB(0, 170, 0)
readyButton.TextColor3 = Color3.new(1, 1, 1)
readyButton.TextScaled = true
readyButton.Text = "Ready Up"
readyButton.Parent = frame

local readyCorner = Instance.new("UICorner")
readyCorner.CornerRadius = UDim.new(0, 8)
readyCorner.Parent = readyButton

local isReady = false

readyButton.Activated:Connect(function()
    isReady = not isReady
    readyButton.Text = if isReady then "Unready" else "Ready Up"
    readyButton.BackgroundColor3 = if isReady
        then Color3.fromRGB(170, 0, 0)
        else Color3.fromRGB(0, 170, 0)
    readyUpEvent:FireServer()
end)

lobbyStatusEvent.OnClientEvent:Connect(function(message: string, countdown: number?, readyCount: number, totalCount: number)
    statusLabel.Text = `{message}\nReady: {readyCount}/{totalCount}`

    if countdown and countdown == 0 then
        screenGui.Enabled = false
    end
end)
```

---

## 5. Round-Based Games

### Round Lifecycle State Machine

A production round system follows a clear state machine:

```
Intermission --> Countdown --> Playing --> Results --> Intermission
```

Each state has entry/exit logic, and the system must handle players joining and leaving at any point.

### Complete Round Manager Implementation

```luau
-- ServerScriptService/RoundManager.luau

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerStorage = game:GetService("ServerStorage")
local Teams = game:GetService("Teams")

-- Remotes
local RoundRemotes = Instance.new("Folder")
RoundRemotes.Name = "RoundRemotes"
RoundRemotes.Parent = ReplicatedStorage

local RoundStateEvent = Instance.new("RemoteEvent")
RoundStateEvent.Name = "RoundState"
RoundStateEvent.Parent = RoundRemotes

local ScoreUpdateEvent = Instance.new("RemoteEvent")
ScoreUpdateEvent.Name = "ScoreUpdate"
ScoreUpdateEvent.Parent = RoundRemotes

-- Configuration
local INTERMISSION_TIME = 15
local COUNTDOWN_TIME = 5
local ROUND_TIME = 120 -- 2 minutes per round
local RESULTS_TIME = 10
local SCORE_TO_WIN = 10

-- Map pool (models stored in ServerStorage/Maps/)
local MAP_NAMES = { "Desert", "Forest", "City" }

---

## Security Hardening

### Never Trust the Client

Every RemoteEvent payload is attacker-controlled. Validate type, range, ownership, and cooldown on the server for every request.

- **Modify any LocalScript** -- injecting code, changing variables, hooking functions.
- **Fire any RemoteEvent with arbitrary arguments** -- types, values, and counts are all attacker-controlled.
- **Speed hack, fly, and teleport** -- the character's physics can be overridden entirely on the client.
- **See all client-accessible code** -- anything in `StarterPlayerScripts`, `StarterGui`, `ReplicatedStorage`, or `ReplicatedFirst` is fully readable.
- **Read and modify any client-side state** -- health displays, cooldown timers, UI flags.
- **Intercept and replay network traffic** -- RemoteSpy tools let exploiters see every remote call and replay or modify them.

**The client is a display layer, not a trusted authority.** It renders the world and collects input. The server decides what actually happens.

A useful mental model: treat every `RemoteEvent:FireServer()` call as if it were an HTTP request from an anonymous stranger on the internet. Validate everything. Assume nothing.

---

### RemoteEvent Validation Patterns

### The Problem

A bare remote handler like this is exploitable:

```luau
-- BAD: No validation at all
DamageRemote.OnServerEvent:Connect(function(player, targetName, damage)
    local target = Players:FindFirstChild(targetName)
    target.Character.Humanoid:TakeDamage(damage)
end)
```

An exploiter can fire this with any target name and any damage value, instantly killing anyone.

### Production-Ready Validation Module

Place this in `ServerScriptService`:

```luau
-- ServerScriptService/Modules/RemoteValidator.luau

local RemoteValidator = {}

--[[ -----------------------------------------------------------------------
    Type Checking
    Validates that arguments match expected types.
----------------------------------------------------------------------- ]]

type TypeSpec = string | (value: any) -> boolean

function RemoteValidator.checkType(value: any, expected: TypeSpec): boolean
    if type(expected) == "function" then
        return expected(value)
    end
    return typeof(value) == expected
end

function RemoteValidator.validateArgs(
    args: { any },
    schema: { { name: string, type: TypeSpec, optional: boolean? } }
): (boolean, string?)
    for i, spec in schema do
        local value = args[i]

        if value == nil then
            if not spec.optional then
                return false, `Missing required argument: {spec.name}`
            end
            continue
        end

        if not RemoteValidator.checkType(value, spec.type) then
            return false, `Invalid type for {spec.name}: expected {tostring(spec.type)}, got {typeof(value)}`
        end
    end

    -- Reject extra arguments that were not declared in the schema
    if #args > #schema then
        return false, `Too many arguments: expected {#schema}, got {#args}`
    end

    return true, nil
end

--[[ -----------------------------------------------------------------------
    Range Checking
    Validates that numeric values fall within acceptable bounds.
----------------------------------------------------------------------- ]]

function RemoteValidator.checkRange(value: number, min: number, max: number): boolean
    return type(value) == "number"
        and value == value -- NaN check
        and value >= min
        and value <= max
end

function RemoteValidator.checkIntegerRange(value: number, min: number, max: number): boolean
    return RemoteValidator.checkRange(value, min, max)
        and math.floor(value) == value
end

--[[ -----------------------------------------------------------------------
    Cooldown Tracking
    Per-player, per-action cooldown enforcement.
----------------------------------------------------------------------- ]]

local cooldowns: { [Player]: { [string]: number } } = {}

function RemoteValidator.checkCooldown(player: Player, action: string, cooldownSeconds: number): boolean
    local now = os.clock()
    local playerCooldowns = cooldowns[player]

    if not playerCooldowns then
        playerCooldowns = {}
        cooldowns[player] = playerCooldowns
    end

    local lastUsed = playerCooldowns[action]
    if lastUsed and (now - lastUsed) < cooldownSeconds then
        return false
    end

    playerCooldowns[action] = now
    return true
end

function RemoteValidator.clearPlayerCooldowns(player: Player)
    cooldowns[player] = nil
end

--[[ -----------------------------------------------------------------------
    Existence Checks
    Validates that targets, objects, and instances actually exist.
----------------------------------------------------------------------- ]]

function RemoteValidator.playerExists(playerName: string): Player?
    local Players = game:GetService("Players")
    return Players:FindFirstChild(playerName) :: Player?
end

function RemoteValidator.characterAlive(player: Player): boolean
    local character = player.Character
    if not character then
        return false
    end

    local humanoid = character:FindFirstChildOfClass("Humanoid")
    if not humanoid then
        return false
    end

    return humanoid.Health > 0
end

function RemoteValidator.instanceExists(parent: Instance, name: string, className: string?): Instance?
    local child = parent:FindFirstChild(name)
    if not child then
        return nil
    end

    if className and not child:IsA(className) then
        return nil
    end

    return child
end

--[[ -----------------------------------------------------------------------
    Authorization
    Checks if a player is allowed to perform an action.
----------------------------------------------------------------------- ]]

function RemoteValidator.playerOwnsItem(player: Player, itemId: string, inventoryFolder: Folder?): boolean
    local folder = inventoryFolder or player:FindFirstChild("Inventory") :: Folder?
    if not folder then
        return false
    end

    return folder:FindFirstChild(itemId) ~= nil
end

function RemoteValidator.playerHasAttribute(player: Player, attribute: string, expectedValue: any?): boolean
    local value = player:GetAttribute(attribute)
    if expectedValue ~= nil then
        return value == expectedValue
    end
    return value ~= nil
end

--[[ -----------------------------------------------------------------------
    Distance Check
    Validates that two positions are within an acceptable range.
----------------------------------------------------------------------- ]]

function RemoteValidator.withinRange(posA: Vector3, posB: Vector3, maxDistance: number): boolean
    return (posA - posB).Magnitude <= maxDistance
end

function RemoteValidator.playerWithinRange(player: Player, targetPos: Vector3, maxDistance: number): boolean
    local character = player.Character
    if not character then
        return false
    end

    local root = character:FindFirstChild("HumanoidRootPart")
    if not root then
        return false
    end

    return RemoteValidator.withinRange(root.Position, targetPos, maxDistance)
end

--[[ -----------------------------------------------------------------------
    Cleanup
----------------------------------------------------------------------- ]]

game:GetService("Players").PlayerRemoving:Connect(function(player)
    RemoteValidator.clearPlayerCooldowns(player)
end)

return RemoteValidator
```

### Using the Validation Module

```luau
-- ServerScriptService/RemoteHandlers/DamageHandler.server.luau

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")

local Validator = require(ServerScriptService.Modules.RemoteValidator)
local DamageRemote = ReplicatedStorage.Remotes.DealDamage

local MAX_DAMAGE = 50
local DAMAGE_COOLDOWN = 0.5 -- seconds
local ATTACK_RANGE = 15    -- studs

local ARG_SCHEMA = {
    { name = "targetPlayer", type = "Instance" },
    { name = "damage",       type = "number" },
}

DamageRemote.OnServerEvent:Connect(function(player: Player, ...: any)
    local args = { ... }

    -- 1. Validate argument types
    local valid, err = Validator.validateArgs(args, ARG_SCHEMA)
    if not valid then
        warn(`[DamageHandler] {player.Name}: {err}`)
        return
    end

    local targetPlayer: Player = args[1]
    local damage: number = args[2]

    -- 2. Validate the target is actually a Player
    if not targetPlayer:IsA("Player") then
        return
    end

    -- 3. Validate damage range
    if not Validator.checkIntegerRange(damage, 1, MAX_DAMAGE) then
        warn(`[DamageHandler] {player.Name}: damage out of range ({damage})`)
        return
    end

    -- 4. Cooldown check
    if not Validator.checkCooldown(player, "DealDamage", DAMAGE_COOLDOWN) then
        return
    end

    -- 5. Verify attacker is alive
    if not Validator.characterAlive(player) then
        return
    end

    -- 6. Verify target is alive
    if not Validator.characterAlive(targetPlayer) then
        return
    end

    -- 7. Range check -- attacker must be near the target
    local targetRoot = targetPlayer.Character and targetPlayer.Character:FindFirstChild("HumanoidRootPart")
    if not targetRoot then
        return
    end

    if not Validator.playerWithinRange(player, targetRoot.Position, ATTACK_RANGE) then
        warn(`[DamageHandler] {player.Name}: target out of range`)
        return
    end

    -- 8. Authorization -- verify the player has a weapon equipped
    local character = player.Character
    local weapon = character and character:FindFirstChildOfClass("Tool")
    if not weapon or not weapon:GetAttribute("CanDealDamage") then
        warn(`[DamageHandler] {player.Name}: no valid weapon equipped`)
        return
    end

    -- 9. Server calculates actual damage (never trust client damage value directly)
    local serverDamage = math.min(damage, weapon:GetAttribute("MaxDamage") or MAX_DAMAGE)

    -- 10. Apply damage
    local targetHumanoid = targetPlayer.Character:FindFirstChildOfClass("Humanoid")
    if targetHumanoid then
        targetHumanoid:TakeDamage(serverDamage)
    end
end)
```

---

### Server-Authoritative Design

The server owns all game state. The client requests actions; the server decides outcomes.

### Movement Validation

```luau
-- ServerScriptService/Security/MovementValidator.server.luau

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local MAX_SPEED = 50             -- studs per second (walk + sprint + tolerance)
local MAX_VERTICAL_SPEED = 100   -- studs per second (jumping/falling tolerance)
local VIOLATION_THRESHOLD = 5    -- strikes before action
local CHECK_INTERVAL = 0.5       -- seconds between checks

local playerData: { [Player]: {
    lastPosition: Vector3,
    lastCheck: number,
    violations: number,
} } = {}

Players.PlayerAdded:Connect(function(player)
    player.CharacterAdded:Connect(function(character)
        local root = character:WaitForChild("HumanoidRootPart")
        playerData[player] = {
            lastPosition = root.Position,
            lastCheck = os.clock(),
            violations = 0,
        }
    end)
end)

Players.PlayerRemoving:Connect(function(player)
    playerData[player] = nil
end)

RunService.Heartbeat:Connect(function()
    local now = os.clock()

    for player, data in playerData do
        if (now - data.lastCheck) < CHECK_INTERVAL then
            continue
        end

        local character = player.Character
        if not character then
            continue
        end

        local root = character:FindFirstChild("HumanoidRootPart")
        if not root then
            continue
        end

        local dt = now - data.lastCheck
        local displacement = root.Position - data.lastPosition
        local horizontalSpeed = Vector3.new(displacement.X, 0, displacement.Z).Magnitude / dt
        local verticalSpeed = math.abs(displacement.Y) / dt

        if horizontalSpeed > MAX_SPEED or verticalSpeed > MAX_VERTICAL_SPEED then
            data.violations += 1
            warn(`[MovementValidator] {player.Name}: speed violation #{data.violations} (h={math.floor(horizontalSpeed)}, v={math.floor(verticalSpeed)})`)

            if data.violations >= VIOLATION_THRESHOLD then
                -- Teleport player back to last valid position
                root.CFrame = CFrame.new(data.lastPosition)
                -- Or kick for persistent abuse:
                -- player:Kick("Movement anomaly detected.")
            end
        else
            -- Decay violations over time for legitimate edge cases
            data.violations = math.max(0, data.violations - 1)
            data.lastPosition = root.Position
        end

        data.lastCheck = now
    end
end)
```

### Damage Validation

```luau
-- Server decides damage, not the client.

local function calculateDamage(attacker: Player, weapon: Tool, target: Player): number?
    local weaponConfig = WeaponDatabase[weapon.Name]
    if not weaponConfig then
        return nil
    end

    -- Server checks weapon cooldown
    local lastFire = weapon:GetAttribute("LastFired") or 0
    if os.clock() - lastFire < weaponConfig.Cooldown then
        return nil
    end

    -- Server checks range
    local attackerRoot = attacker.Character and attacker.Character:FindFirstChild("HumanoidRootPart")
    local targetRoot = target.Character and target.Character:FindFirstChild("HumanoidRootPart")
    if not attackerRoot or not targetRoot then
        return nil
    end

    local distance = (attackerRoot.Position - targetRoot.Position).Magnitude
    if distance > weaponConfig.Range then
        return nil
    end

    -- Server calculates damage
    weapon:SetAttribute("LastFired", os.clock())
    return weaponConfig.BaseDamage
end
```

### Currency Transactions

```luau
-- WRONG: Client tells server how much to add
CurrencyRemote.OnServerEvent:Connect(function(player, amount)
    player.leaderstats.Gold.Value += amount -- exploiter sends 999999
end)

-- RIGHT: Server calculates the reward
QuestCompleteRemote.OnServerEvent:Connect(function(player, questId)
    -- Validate quest ID type
    if typeof(questId) ~= "string" then
        return
    end

    -- Server checks quest state
    local questData = PlayerQuestData[player]
    if not questData or not questData[questId] then
        return
    end

    if questData[questId].completed then
        return -- already claimed
    end

    -- Server looks up the reward from its own data
    local questConfig = QuestDatabase[questId]
    if not questConfig then
        return
    end

    -- Server awards the reward
    questData[questId].completed = true
    player.leaderstats.Gold.Value += questConfig.Reward
end)
```

### Inventory Operations

```luau
-- Server-side trade validation
local function executeTrade(playerA: Player, playerB: Player, itemIdA: string, itemIdB: string): boolean
    -- Both players must be alive and in range
    if not Validator.characterAlive(playerA) or not Validator.characterAlive(playerB) then
        return false
    end

    -- Verify ownership on the server
    local invA = playerA:FindFirstChild("Inventory")
    local invB = playerB:FindFirstChild("Inventory")
    if not invA or not invB then
        return false
    end

---

## Rate Limiting

Roblox's built-in throttle (~500 req/sec per client) is NOT a substitute for custom rate limiting. Players can still spam remotes at hundreds of requests per second. You need application-level throttling.

### Pattern 1: Per-Player Cooldown Table

Simple and effective for most games. Each remote has a minimum time between calls per player.

```luau
local cooldowns: {[Player]: {[string]: number}} = {}
local COOLDOWN = 0.2 -- seconds between calls

local function isThrottled(player: Player, remoteName: string): boolean
    local now = os.clock()
    if not cooldowns[player] then
        cooldowns[player] = {}
    end

    local lastCall = cooldowns[player][remoteName]
    if lastCall and (now - lastCall) < COOLDOWN then
        return true -- throttled
    end

    cooldowns[player][remoteName] = now
    return false
end

-- Clean up when player leaves
Players.PlayerRemoving:Connect(function(player)
    cooldowns[player] = nil
end)

-- Usage
BuyItem.OnServerEvent:Connect(function(player, itemId)
    if isThrottled(player, "BuyItem") then return end
    -- process purchase
end)
```

### Pattern 2: Declarative Remote Definitions

Define all remotes in one place with rate limits, validation, and allowed states. Cleaner than scattered OnServerEvent handlers.

```luau
type RemoteDef = {
    RateLimit: number?,
    Validate: (Player, ...any) -> boolean,
    Handler: (Player, ...any) -> (),
}

local Remotes: {[string]: RemoteDef} = {
    BuyItem = {
        RateLimit = 0.5,
        Validate = function(player, itemId)
            return typeof(itemId) == "string" and #itemId < 50
        end,
        Handler = function(player, itemId)
            -- process purchase
        end,
    },
    EquipTool = {
        RateLimit = 0.3,
        Validate = function(player, toolId)
            return typeof(toolId) == "string"
        end,
        Handler = function(player, toolId)
            -- equip tool
        end,
    },
}

-- Wire up automatically
for name, def in Remotes do
    local remote = ReplicatedStorage:WaitForChild(name)
    remote.OnServerEvent:Connect(function(player, ...)
        if def.RateLimit and isThrottled(player, name) then return end
        if not def.Validate(player, ...) then return end
        def.Handler(player, ...)
    end)
end
```

### Pattern 3: Suspicion Scoring

For high-stakes games. Track suspicious behavior over time instead of hard-blocking.

```luau
local suspicion: {[Player]: number} = {}
local SUSPICION_THRESHOLD = 10
local DECAY_RATE = 1 -- points lost per second

local function addSuspicion(player: Player, amount: number, reason: string)
    suspicion[player] = (suspicion[player] or 0) + amount
    if suspicion[player] >= SUSPICION_THRESHOLD then
        warn(`High suspicion for {player.Name}: {reason}`)
    end
end

-- In remote handler
BuyItem.OnServerEvent:Connect(function(player, itemId)
    if isThrottled(player, "BuyItem") then
        addSuspicion(player, 2, "rate limit exceeded")
        return
    end
    -- normal processing
end)

-- Decay suspicion over time
task.spawn(function()
    while true do
        task.wait(1)
        for player, score in suspicion do
            suspicion[player] = math.max(0, score - DECAY_RATE)
        end
    end
end)
```

### What NOT to Do

```luau
-- BAD: no rate limiting at all
BuyItem.OnServerEvent:Connect(function(player, itemId)
    -- exploiter can call this 1000 times/second
    grantItem(player, itemId)
end)

-- BAD: client-side rate limiting (exploiter bypasses)
-- Rate limiting MUST be server-side
```

Source: Roblox Server-Side Detection Guide (Roblox/creator-docs, MIT), DevForum rate limiting patterns
