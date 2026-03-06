/**
 * Run the plugin bootstrap demo.
 * Reads outputDir and app.root from plugin.manifest.ts source to compute the bootstrap path dynamically.
 *
 * Usage: node ./scripts/demo.mjs
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

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

const srcDir = path.resolve(cwd, "src");
const found = await findManifests(srcDir);
if (found.length === 0) {
  console.error("No plugin.manifest.ts found under src/.");
  process.exit(1);
}
if (found.length > 1) {
  console.error("Multiple plugin.manifest.ts found. Provide a path explicitly:");
  for (const f of found) console.error(`  ${path.relative(cwd, f)}`);
  process.exit(1);
}

const manifestSourcePath = found[0];
const manifestSource = await fs.readFile(manifestSourcePath, "utf8");

function extractStringField(source, fieldName) {
  const pattern = new RegExp(`${fieldName}:\\s*["']([^"']+)["']`);
  const match = source.match(pattern);
  return match?.[1] ?? null;
}

const tsconfigPath = path.resolve(cwd, "tsconfig.json");
const tsconfig = JSON.parse(await fs.readFile(tsconfigPath, "utf8"));
const tscRootDir = path.resolve(cwd, tsconfig.compilerOptions?.rootDir ?? "./src");

const outputDir = extractStringField(manifestSource, "outputDir") ?? "dist";

// bootstrap.ts sits next to plugin.manifest.ts, compute its compiled path
const bootstrapSourcePath = path.join(path.dirname(manifestSourcePath), "bootstrap.ts");
const relativeBootstrapPath = path.relative(tscRootDir, bootstrapSourcePath);
const compiledBootstrapPath = path.resolve(cwd, outputDir, relativeBootstrapPath.replace(/\.ts$/, ".js"));

console.log(`Running: node ${path.relative(cwd, compiledBootstrapPath)}`);
execSync(`node "${compiledBootstrapPath}"`, { cwd, stdio: "inherit" });
