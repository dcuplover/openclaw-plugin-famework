/**
 * Unified build orchestrator for OpenClaw plugin framework.
 * Reads all paths from plugin.manifest.ts source, eliminating hardcoded paths in package.json.
 *
 * Usage: node ./scripts/build.mjs [manifest-source-path]
 *
 * When no argument is provided, auto-discovers all plugin.manifest.ts files under src/.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const [, , manifestSourceArg] = process.argv;

const cwd = process.cwd();

async function findManifests(dir) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findManifests(fullPath)));
    } else if (entry.name === "plugin.manifest.ts") {
      results.push(fullPath);
    }
  }
  return results;
}

let manifestSourcePath;
if (manifestSourceArg) {
  manifestSourcePath = path.resolve(cwd, manifestSourceArg);
} else {
  const srcDir = path.resolve(cwd, "src");
  const found = await findManifests(srcDir);
  if (found.length === 0) {
    console.error("No plugin.manifest.ts found under src/. Provide a path explicitly.");
    process.exit(1);
  }
  if (found.length > 1) {
    console.error("Multiple plugin.manifest.ts found. Provide a path explicitly:");
    for (const f of found) console.error(`  ${path.relative(cwd, f)}`);
    process.exit(1);
  }
  manifestSourcePath = found[0];
  console.log(`Auto-discovered manifest: ${path.relative(cwd, manifestSourcePath)}`);
}

// --- Read tsconfig.json for rootDir default ---
const tsconfigPath = path.resolve(cwd, "tsconfig.json");
const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, "utf8"));
const tscRootDir = path.resolve(cwd, tsconfig.compilerOptions?.rootDir ?? "./src");

// --- Extract pre-build settings from manifest TS source via regex ---
// This avoids the chicken-and-egg problem of needing compilation before reading the manifest.
const manifestSource = await fs.readFile(manifestSourcePath, "utf8");

function extractStringField(source, fieldName) {
  const pattern = new RegExp(`${fieldName}:\\s*["']([^"']+)["']`);
  const match = source.match(pattern);
  return match?.[1] ?? null;
}

const appRoot = extractStringField(manifestSource, "root");
const registryPath =
  extractStringField(manifestSource, "registryPath") ??
  extractStringField(manifestSource, "registryOutput") ??
  "src/generated/registry.ts";
const outputDir = extractStringField(manifestSource, "outputDir") ?? "artifacts";
const pluginId = extractStringField(manifestSource, "id");

if (!appRoot) {
  throw new Error(
    "Could not extract app.root from manifest source. Ensure it uses a string literal."
  );
}

if (!pluginId) {
  throw new Error(
    "Could not extract id from manifest source. Ensure it uses a string literal."
  );
}

// Compile tsc directly into <outputDir>/<pluginId>/ — no intermediate directory.
const artifactDir = path.resolve(cwd, outputDir, pluginId);

// --- Compute compiled manifest path ---
const relativeManifestPath = path.relative(tscRootDir, manifestSourcePath);
const compiledManifestRelative = relativeManifestPath.replace(/\.ts$/, ".js");
const compiledManifestPath = path.resolve(artifactDir, compiledManifestRelative);
const compiledManifestArg = path.relative(cwd, compiledManifestPath);

function run(label, command) {
  console.log(`\n--- ${label} ---`);
  execSync(command, { cwd, stdio: "inherit" });
}

// --- Phase 1: Generate registry ---
run(
  "Generating registry",
  `node ./scripts/generate-registry.mjs "${appRoot}" "${registryPath}"`
);

// --- Phase 2: Clean previous artifact & compile TypeScript directly to artifact dir ---
await fs.rm(artifactDir, { recursive: true, force: true });
const artifactDirRelative = path.relative(cwd, artifactDir);
run(
  `Compiling TypeScript → ${artifactDirRelative}/`,
  `npx tsc -p tsconfig.json --outDir "${artifactDirRelative}"`
);

// --- Phase 3: Sync package.json (before entry shim overwrites index.js) ---
run(
  "Syncing package.json",
  `node ./scripts/sync-package-json.mjs "${compiledManifestArg}"`
);

// --- Phase 4: Generate OpenClaw plugin manifest ---
run(
  "Generating OpenClaw plugin manifest",
  `node ./scripts/generate-plugin-manifest.mjs "${compiledManifestArg}"`
);

// --- Phase 5: Validate plugin ---
run(
  "Validating plugin",
  `node ./scripts/validate-plugin.mjs "${compiledManifestArg}"`
);

// --- Phase 6: Create entry shims (replaces framework barrel with app entry) ---
run(
  "Creating entry shims",
  `node ./scripts/stage-plugin-artifact.mjs "${compiledManifestArg}"`
);

console.log(`\nBuild complete. Artifact: ${artifactDirRelative}/`);
