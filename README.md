# OpenClaw Convention Microkernel Framework

A standalone prototype of a convention-based microkernel framework for the OpenClaw plugin ecosystem.

## What this folder contains

- A microkernel with dependency injection and lifecycle orchestration.
- First-class contracts for modules, tools, hooks, and commands.
- A first-class plugin manifest contract via `definePlugin()`.
- A build-time registry generator for convention-based discovery.
- A build-time plugin manifest generator for plugin artifacts under `artifacts/example-app/`.
- A package metadata sync step driven from `PluginManifest`.
- A validation step that checks plugin artifacts stay aligned with `PluginManifest`.
- A thin example plugin entrypoint at `src/example-app/index.ts` for OpenClaw host loading.
- A mock OpenClaw host adapter and a runnable example app.

## Core design principles

1. Convention over configuration for feature discovery.
2. Build-time registry generation instead of fragile runtime scanning.
3. Explicit contracts for every loadable unit.
4. Dependency-ordered module boot with observability.
5. Host integration through adapters, not hardcoded framework assumptions.

## Directory conventions

```text
src/example-app/
  modules/*.module.ts
  tools/*.tool.ts
  hooks/*.hook.ts
  commands/*.command.ts
```

The generator scans the directories above and writes `src/generated/registry.ts`.

## Commands

```bash
npm install
npm run build
npm run demo
```

`npm run build` now generates `src/generated/registry.ts`, compiles runtime code into `dist/`, stages a loadable plugin tree under `artifacts/example-app/`, writes guide-compatible `artifacts/example-app/package.json` and `artifacts/example-app/openclaw.plugin.json`, and validates that the plugin artifacts stay aligned with `PluginManifest`.

Use `artifacts/example-app/` as the plugin root for `plugins.load.paths` or local installation. The `dist/` folder is now treated as compile output only.

## Documentation

- `README.md`: quick project overview
- `ARCHITECTURE.md`: architectural rationale and evolution direction
- `USAGE_GUIDE.zh-CN.md`: detailed framework usage guide in Chinese

## Main exported concepts

- `defineModule()`
- `defineTool()`
- `defineHook()`
- `defineCommand()`
- `definePlugin()`
- `PluginManifest`
- `toOpenClawPluginJson()`
- `toPackageJsonFields()`
- `bootstrapMicrokernel()`
- `createOpenClawAdapter()`
- `bootstrapOpenClawPlugin()`

## Plugin-level contract

The framework now includes a plugin manifest layer in addition to runtime definitions.

- `definePlugin()` declares plugin identity, OpenClaw metadata, config schema, and build hints.
- `PluginManifest` is the typed single source of truth for plugin packaging metadata.
- `toOpenClawPluginJson()` converts the framework manifest into the host-facing `openclaw.plugin.json` shape described by the OpenClaw guide.
- `toPackageJsonFields()` projects package-level fields such as `name`, `version`, `description`, `main`, `types`, and `openclaw.extensions`.
- `bootstrapOpenClawPlugin()` creates a thin host-facing entrypoint from a plugin manifest and generated registry.
- `src/example-app/plugin.manifest.ts` shows the recommended starting point for a real plugin package.

## Thin plugin entry

`src/example-app/index.ts` now acts as the real plugin entrypoint.

- `src/index.ts` remains the framework library export surface.
- `src/example-app/index.ts` imports `src/example-app/plugin.manifest.ts`.
- `src/example-app/index.ts` imports `src/generated/registry.ts`.
- `src/example-app/index.ts` exports `default` as a guide-compatible plugin object with `register(api)`.

The host-facing shape is intentionally thin:

```ts
export default {
  id: pluginManifest.id,
  configSchema: pluginManifest.configSchema,
  async register(api) {
    return bootstrapOpenClawPlugin(pluginManifest, registry)({
      api,
      config: api.pluginConfig,
    });
  },
};
```

That keeps plugin metadata, runtime assembly, and host adaptation separate.

## Validation

Run this explicitly if you want a consistency check without re-reading the source code manually:

```bash
npm run validate:plugin
```

It compares:

- `PluginManifest -> artifacts/example-app/package.json`
- `PluginManifest -> artifacts/example-app/openclaw.plugin.json`

If any field drifts, the script exits non-zero and prints the mismatched field names with actual vs expected values.

## Why this matters

This prototype does not implement the memory system itself. It builds the reusable application substrate that future OpenClaw plugins can sit on top of.
