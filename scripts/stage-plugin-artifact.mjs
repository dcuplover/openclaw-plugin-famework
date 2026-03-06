import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";

const [, , manifestModuleArg, artifactRootArg] = process.argv;

if (!manifestModuleArg) {
  console.error("Usage: node stage-plugin-artifact.mjs <compiled-manifest-module> [artifact-root]");
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
const compiledRootDir = path.resolve(compiledAppDir, "..");
const entryPath = pluginManifest.build?.artifactEntry ?? "./index.js";
const compiledAppDirName = path.basename(compiledAppDir);

if (typeof entryPath !== "string" || entryPath.length === 0) {
  throw new Error("Plugin manifest must declare build.artifactEntry before staging artifacts.");
}

const artifactRoot = path.resolve(
  cwd,
  artifactRootArg ?? pluginManifest.build?.artifactRoot ?? path.join("artifacts", pluginManifest.id)
);

if (path.basename(artifactRoot) !== pluginManifest.id) {
  throw new Error(
    `Artifact root basename must match plugin id. Expected "${pluginManifest.id}", got "${path.basename(artifactRoot)}".`
  );
}

const copyPlan = [
  {
    source: path.join(compiledRootDir, "framework"),
    target: path.join(artifactRoot, "framework"),
  },
  {
    source: path.join(compiledRootDir, "generated"),
    target: path.join(artifactRoot, "generated"),
  },
  {
    source: compiledAppDir,
    target: path.join(artifactRoot, compiledAppDirName),
  },
];

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

await fs.rm(artifactRoot, { recursive: true, force: true });
await fs.mkdir(artifactRoot, { recursive: true });

for (const { source, target } of copyPlan) {
  await fs.cp(source, target, { recursive: true });
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

console.log(`Staged plugin artifact at ${artifactRoot}`);