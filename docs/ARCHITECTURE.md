# Framework Architecture

## Positioning

This prototype is a convention-based microkernel for the OpenClaw plugin ecosystem.
It is not a memory implementation. It is the substrate that future plugins can build on.

## Design Thesis

A durable plugin framework should avoid fragile runtime directory scanning.
Instead, it should combine these traits:

1. Convention-driven feature discovery for developer ergonomics.
2. Build-time registry generation for deterministic boot.
3. Explicit contracts for modules, tools, hooks, and commands.
4. Dependency-ordered startup and reverse-order shutdown.
5. Host adaptation through an adapter boundary.

## Core Layers

### 1. Definition Layer

Files under convention directories export one of these contracts:

- `defineModule()`
- `defineTool()`
- `defineHook()`
- `defineCommand()`

This keeps every loadable unit explicit and testable.

### 2. Discovery Layer

The file `scripts/generate-registry.mjs` scans the convention directories and generates `src/generated/registry.ts`.

This means the framework gets automatic discovery without losing determinism.

### 3. Kernel Layer

`bootstrapMicrokernel()` performs:

1. Core service registration.
2. Module loading and dependency ordering.
3. Module setup and startup.
4. Tool, hook, and command registration.
5. Diagnostics collection.
6. Reverse-order shutdown.

### 4. Host Adapter Layer

The framework does not hardcode OpenClaw APIs into the kernel.
Instead it exposes a `HostAdapter` abstraction.

This allows:

- Real OpenClaw integration through `createOpenClawAdapter()`
- In-memory testing through `MockHostAdapter`
- Future support for other hosts without rewriting the kernel

## Convention Contract

The current prototype scans:

```text
src/example-app/modules/*.module.ts
src/example-app/tools/*.tool.ts
src/example-app/hooks/*.hook.ts
src/example-app/commands/*.command.ts
```

A production version should generalize this into app manifests or package-level app roots.

## Why Build-Time Registry Wins

Compared with runtime scanning, build-time generation provides:

- better startup determinism
- simpler debugging
- easier bundling and packaging
- earlier validation failures
- safer host deployment

## Packaging Boundary

This prototype now treats compiled code and installable plugin artifacts as separate concerns.

- `dist/` is the TypeScript compiler output and internal runtime build cache.
- `artifacts/<plugin-id>/` is the host-facing plugin root used by OpenClaw loading.
- The artifact directory basename should match `PluginManifest.id` so host path loading and plugin identity do not drift.

That boundary avoids the common confusion where a generic folder like `dist/` is accidentally treated as the plugin's public root.

## Future Evolution

1. Add manifest-driven multi-app support.
2. Add schema validation for definitions.
3. Add capability-based dependency tokens instead of raw strings.
4. Add health probes and richer module telemetry.
5. Add a formal OpenClaw command adapter once host CLI APIs stabilize.
6. Add test helpers for isolated module boot.

## Strategic Value

Once this kernel exists, the memory plugin becomes only one application built on top of it.
That unlocks a larger ecosystem:

- memory plugins
- workflow plugins
- observability plugins
- retrieval plugins
- domain-specific agent extensions
