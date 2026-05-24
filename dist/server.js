// src/index.ts
import { tool } from "@opencode-ai/plugin";
var VERSION = "1.0.0";
var MARKER_BEGIN = `<!-- roblox-opencode ${VERSION} BEGIN \u2014 managed block, edits inside will be overwritten -->`;
var MARKER_END = "<!-- roblox-opencode END -->";
var RobloxOpenCode = async () => {
  try {
    const { existsSync, mkdirSync, readdirSync, copyFileSync } = await import("fs");
    const { join } = await import("path");
    const os = await import("os");
    const pkgDir = join(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
    const srcDir = join(pkgDir, "commands");
    const destDir = join(os.homedir(), ".config", "opencode", "commands");
    if (existsSync(srcDir)) {
      mkdirSync(destDir, { recursive: true });
      const files = readdirSync(srcDir).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        copyFileSync(join(srcDir, file), join(destDir, file));
      }
    }
  } catch {
  }
  return {
    tool: {
      roblox_setup: tool({
        description: "One-time project setup for roblox-opencode. Copies 12 skills and vendor libraries (rbxutil, profilestore, promise, testez, t) to the project, writes luau-lsp config to opencode.json, and writes the core Roblox agent instructions to AGENTS.md. Run this when first opening a Roblox project.",
        args: {},
        async execute(_args, context) {
          return await runSetup(context.directory);
        }
      })
    }
  };
};
async function runSetup(directory) {
  const { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } = await import("fs");
  const { join } = await import("path");
  const pkgDir = join(import.meta.dirname ?? new URL(".", import.meta.url).pathname, "..");
  const projectDir = directory;
  const steps = [];
  steps.push({
    name: "Copy 12 skills to .opencode/skills/",
    fn: () => {
      const src = join(pkgDir, "skills");
      const dest = join(projectDir, ".opencode", "skills");
      if (!existsSync(src)) throw new Error(`skills/ not found in plugin at ${src}`);
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
    }
  });
  steps.push({
    name: "Copy vendor libraries to project",
    fn: () => {
      const src = join(pkgDir, "vendor");
      const dest = join(projectDir, "vendor");
      if (!existsSync(src)) throw new Error(`vendor/ not found in plugin at ${src}`);
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
    }
  });
  steps.push({
    name: "Write LSP config (luau-lsp)",
    fn: () => {
      const configPath = join(projectDir, "opencode.json");
      let config = {};
      if (existsSync(configPath)) {
        try {
          config = JSON.parse(readFileSync(configPath, "utf-8"));
        } catch {
        }
      }
      config.lsp = {
        ...config.lsp || {},
        luau: {
          command: ["luau-lsp", "lsp"],
          extensions: [".luau"]
        }
      };
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    }
  });
  steps.push({
    name: "Write core block to AGENTS.md",
    fn: () => {
      const agentsPath = join(projectDir, "AGENTS.md");
      const corePath = join(pkgDir, "core", "roblox-core.md");
      if (!existsSync(corePath)) throw new Error(`core/roblox-core.md not found in plugin at ${corePath}`);
      const coreContent = readFileSync(corePath, "utf-8");
      const block = `${MARKER_BEGIN}
${coreContent}
${MARKER_END}`;
      let agentsContent = "";
      if (existsSync(agentsPath)) {
        agentsContent = readFileSync(agentsPath, "utf-8");
      }
      const beginPattern = /<!-- roblox-opencode[^>]*BEGIN[^>]*-->/;
      const endPattern = /<!-- roblox-opencode END -->/;
      const oldBeginPattern = /<!-- roblox-pi[^>]*BEGIN[^>]*-->/;
      const oldEndPattern = /<!-- roblox-pi END -->/;
      let newContent;
      if (beginPattern.test(agentsContent) && endPattern.test(agentsContent)) {
        newContent = agentsContent.replace(
          new RegExp(`${beginPattern.source}[\\s\\S]*?${endPattern.source}`),
          block
        );
      } else if (oldBeginPattern.test(agentsContent) && oldEndPattern.test(agentsContent)) {
        newContent = agentsContent.replace(
          new RegExp(`${oldBeginPattern.source}[\\s\\S]*?${oldEndPattern.source}`),
          block
        );
      } else {
        newContent = agentsContent ? agentsContent.trimEnd() + "\n\n" + block + "\n" : block + "\n";
      }
      writeFileSync(agentsPath, newContent);
    }
  });
  const results = [];
  for (const step of steps) {
    try {
      step.fn();
      results.push({ step: step.name, status: "ok" });
    } catch (err) {
      results.push({
        step: step.name,
        status: "error",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  return results;
}
async function writeMcpConfig(directory, servers) {
  const { existsSync, readFileSync, writeFileSync } = await import("fs");
  const { join } = await import("path");
  const configPath = join(directory, "opencode.json");
  let config = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
    }
  }
  const mcp = {};
  if (servers.studio) {
    mcp.studio = { type: "local", command: ["npx", "-y", "@weppy/roblox-mcp"], enabled: true };
  }
  if (servers.robloxDocs) {
    mcp["roblox-docs"] = { type: "local", command: ["uvx", "mcp-roblox-docs"], enabled: true };
  }
  config.mcp = { ...config.mcp || {}, ...mcp };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}
var index_default = {
  id: "roblox-opencode",
  server: RobloxOpenCode
};
export {
  RobloxOpenCode,
  index_default as default,
  runSetup,
  writeMcpConfig
};
