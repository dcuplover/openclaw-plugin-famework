import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";

const [, , manifestModuleArg, outputArg] = process.argv;

if (!manifestModuleArg) {
  console.error("Usage: node generate-plugin-manifest.mjs <compiled-manifest-module> [output-file]");
  process.exit(1);
}

const cwd = process.cwd();
const manifestModulePath = path.resolve(cwd, manifestModuleArg);
const require = createRequire(import.meta.url);

const manifestModule = require(manifestModulePath);
const compiledRoot = path.resolve(path.dirname(manifestModulePath), "..");
const frameworkModule = require(path.resolve(compiledRoot, "index.js"));
const pluginManifest = manifestModule.default;
const toOpenClawPluginJson = frameworkModule.toOpenClawPluginJson;

if (!pluginManifest || typeof pluginManifest !== "object") {
  throw new Error(`Compiled module does not export a default plugin manifest: ${manifestModulePath}`);
}

if (typeof toOpenClawPluginJson !== "function") {
  throw new Error(
    `Compiled module does not expose toOpenClawPluginJson(). Check framework exports in ${manifestModulePath}`
  );
}

const resolvedOutput = outputArg
  ? path.resolve(cwd, outputArg)
  : path.resolve(cwd, pluginManifest.build?.pluginManifestOutput ?? "openclaw.plugin.json");

const openClawPluginJson = toOpenClawPluginJson(pluginManifest);

await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
await fs.writeFile(resolvedOutput, `${JSON.stringify(openClawPluginJson, null, 2)}\n`, "utf8");

console.log(`Generated OpenClaw plugin manifest at ${resolvedOutput}`);
