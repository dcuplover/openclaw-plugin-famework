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
const entryPath = pluginManifest.openclaw?.entry;

if (typeof entryPath !== "string" || entryPath.length === 0) {
  throw new Error("Plugin manifest must declare openclaw.entry before staging artifacts.");
}

const artifactEntryDir = path.dirname(entryPath.replace(/^\.\//, ""));
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
    target: artifactEntryDir === "." ? artifactRoot : path.join(artifactRoot, artifactEntryDir),
  },
];

await fs.rm(artifactRoot, { recursive: true, force: true });
await fs.mkdir(artifactRoot, { recursive: true });

for (const { source, target } of copyPlan) {
  await fs.cp(source, target, { recursive: true });
}

console.log(`Staged plugin artifact at ${artifactRoot}`);