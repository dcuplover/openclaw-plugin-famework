import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";

const [, , manifestModuleArg, packageJsonArg, openClawPluginJsonArg] = process.argv;

if (!manifestModuleArg) {
  console.error(
    "Usage: node validate-plugin.mjs <compiled-manifest-module> [package-json-file] [openclaw-plugin-json-file]"
  );
  process.exit(1);
}

const cwd = process.cwd();
const manifestModulePath = path.resolve(cwd, manifestModuleArg);
const packageJsonPath = packageJsonArg ? path.resolve(cwd, packageJsonArg) : undefined;
const openClawPluginJsonPath = openClawPluginJsonArg ? path.resolve(cwd, openClawPluginJsonArg) : undefined;
const require = createRequire(import.meta.url);

function stableStringify(value) {
  return JSON.stringify(value, null, 2);
}

function compareField(mismatches, label, actual, expected) {
  if (stableStringify(actual) !== stableStringify(expected)) {
    mismatches.push({ label, actual, expected });
  }
}

const manifestModule = require(manifestModulePath);
const frameworkModule = require(path.resolve(cwd, "./dist/index.js"));
const pluginManifest = manifestModule.default;
const toPackageJsonFields = frameworkModule.toPackageJsonFields;
const toOpenClawPluginJson = frameworkModule.toOpenClawPluginJson;

if (!pluginManifest || typeof pluginManifest !== "object") {
  throw new Error(`Compiled module does not export a default plugin manifest: ${manifestModulePath}`);
}

if (typeof toPackageJsonFields !== "function") {
  throw new Error("Compiled framework does not export toPackageJsonFields(). Check dist/index.js");
}

if (typeof toOpenClawPluginJson !== "function") {
  throw new Error("Compiled framework does not export toOpenClawPluginJson(). Check dist/index.js");
}

const expectedPackageJsonFields = toPackageJsonFields(pluginManifest);
const expectedOpenClawPluginJson = toOpenClawPluginJson(pluginManifest);
const resolvedPackageJsonPath =
  packageJsonPath ?? path.resolve(cwd, pluginManifest.build?.packageJsonOutput ?? "./package.json");
const resolvedOpenClawPluginJsonPath =
  openClawPluginJsonPath ??
  path.resolve(cwd, pluginManifest.build?.pluginManifestOutput ?? "./openclaw.plugin.json");
const packageJson = JSON.parse(await fs.readFile(resolvedPackageJsonPath, "utf8"));
const openClawPluginJson = JSON.parse(await fs.readFile(resolvedOpenClawPluginJsonPath, "utf8"));
const mismatches = [];

for (const [key, expected] of Object.entries(expectedPackageJsonFields)) {
  compareField(mismatches, `package.json:${key}`, packageJson[key], expected);
}

for (const [key, expected] of Object.entries(expectedOpenClawPluginJson)) {
  compareField(mismatches, `openclaw.plugin.json:${key}`, openClawPluginJson[key], expected);
}

if (mismatches.length > 0) {
  console.error("Plugin validation failed. The following fields are out of sync:");
  for (const mismatch of mismatches) {
    console.error(`- ${mismatch.label}`);
    console.error(`  actual:   ${stableStringify(mismatch.actual)}`);
    console.error(`  expected: ${stableStringify(mismatch.expected)}`);
  }
  process.exit(1);
}

console.log(
  `Plugin validation passed for ${path.relative(cwd, manifestModulePath)} against ${path.relative(cwd, resolvedPackageJsonPath)} and ${path.relative(cwd, resolvedOpenClawPluginJsonPath)}`
);
