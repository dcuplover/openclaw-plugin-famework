# OpenClaw Convention Microkernel Framework

A standalone prototype of a convention-based microkernel framework for the OpenClaw plugin ecosystem.

## What this folder contains

- A microkernel with dependency injection and lifecycle orchestration.
- First-class contracts for modules, tools, hooks, and commands.
- A first-class plugin manifest contract via `definePlugin()`.
- A build-time registry generator for convention-based discovery.
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
cd framework
npm run build
npm run demo
```

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
- `bootstrapMicrokernel()`
- `createOpenClawAdapter()`

## Plugin-level contract

The framework now includes a plugin manifest layer in addition to runtime definitions.

- `definePlugin()` declares plugin identity, OpenClaw metadata, config schema, and build hints.
- `PluginManifest` is the typed single source of truth for plugin packaging metadata.
- `src/example-app/plugin.manifest.ts` shows the recommended starting point for a real plugin package.

## Why this matters

This prototype does not implement the memory system itself. It builds the reusable application substrate that future OpenClaw plugins can sit on top of.
