/**
 * Creates entry shim files for the plugin artifact.
 * Assumes tsc has already compiled directly into the artifact directory.
 *
 * Usage: node stage-plugin-artifact.mjs <compiled-manifest-module>
 */

import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";

const [, , manifestModuleArg] = process.argv;

if (!manifestModuleArg) {
  console.error("Usage: node stage-plugin-artifact.mjs <compiled-manifest-module>");
  process.exit(1);
}

const cwd = process.cwd();
const manifestModulePath = path.resolve(cwd, manifestModuleArg);
const require = createRequire(import.meta.url);
const manifestModule = require(manifestModulePath);
const pluginManifest = manifestModule.default;

if (!pluginManifest || typeof pluginManifest !== "object") {
  throw new Error(`Compiled module does not export a default plugin manifest: ${manifestModulePath}`);
}

const compiledAppDir = path.dirname(manifestModulePath);
const artifactRoot = path.resolve(compiledAppDir, "..");
const entryPath = pluginManifest.build?.artifactEntry ?? "./index.js";
const compiledAppDirName = path.basename(compiledAppDir);

if (typeof entryPath !== "string" || entryPath.length === 0) {
  throw new Error("Plugin manifest must declare build.artifactEntry before creating entry shims.");
}

function toCompiledRuntimePath(entrySource) {
  const entryFileName = path.basename(entrySource ?? "index.ts");
  return entryFileName.replace(/\.(ts|tsx|mts|cts)$/, ".js");
}

function toCompiledDeclarationPath(runtimeFileName) {
  return runtimeFileName.endsWith(".js") ? `${runtimeFileName.slice(0, -3)}.d.ts` : `${runtimeFileName}.d.ts`;
}

function toPosixRelative(fromPath, toPath, keepExtension = true) {
  let relativePath = path.relative(path.dirname(fromPath), toPath).replace(/\\/g, "/");

  if (!keepExtension) {
    relativePath = relativePath.replace(/\.d\.ts$/, "").replace(/\.ts$/, "").replace(/\.js$/, "");
  }

  if (!relativePath.startsWith(".")) {
    relativePath = `./${relativePath}`;
  }

  return relativePath;
}

const normalizedEntryPath = entryPath.replace(/^\.\//, "");
const artifactRuntimeEntryPath = path.join(artifactRoot, normalizedEntryPath);
const compiledRuntimeFileName = toCompiledRuntimePath(pluginManifest.build?.entrySource);
const compiledRuntimeEntryPath = path.join(artifactRoot, compiledAppDirName, compiledRuntimeFileName);
const artifactDeclarationEntryPath = artifactRuntimeEntryPath.endsWith(".js")
  ? `${artifactRuntimeEntryPath.slice(0, -3)}.d.ts`
  : `${artifactRuntimeEntryPath}.d.ts`;
const compiledDeclarationEntryPath = path.join(
  artifactRoot,
  compiledAppDirName,
  toCompiledDeclarationPath(compiledRuntimeFileName)
);

await fs.mkdir(path.dirname(artifactRuntimeEntryPath), { recursive: true });
await fs.writeFile(
  artifactRuntimeEntryPath,
  [
    '"use strict";',
    `module.exports = require(${JSON.stringify(toPosixRelative(artifactRuntimeEntryPath, compiledRuntimeEntryPath))});`,
    "",
  ].join("\n"),
  "utf8"
);
await fs.writeFile(
  artifactDeclarationEntryPath,
  [
    `export { default } from ${JSON.stringify(toPosixRelative(artifactDeclarationEntryPath, compiledDeclarationEntryPath, false))};`,
    "",
  ].join("\n"),
  "utf8"
);

console.log(`Created entry shims at ${artifactRoot}`);