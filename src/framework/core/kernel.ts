import { MapServiceContainer } from "./container";
import { createConsoleLogger } from "./logger";
import { loadDefinitions } from "./registry";
import type {
  BootstrapOptions,
  CliDefinition,
  CommandDefinition,
  HookDefinition,
  KernelDiagnostics,
  KernelRuntime,
  ModuleContext,
  ModuleDefinition,
  RuntimeContext,
  ToolDefinition,
} from "./types";

function createDiagnostics(): KernelDiagnostics {
  return {
    loadedModules: [],
    loadedTools: [],
    loadedHooks: [],
    loadedClis: [],
    loadedCommands: [],
    timings: {},
    failures: [],
  };
}

function createContext<TConfig>(
  config: TConfig,
  container: MapServiceContainer,
  diagnostics: KernelDiagnostics,
  logger: ModuleContext<TConfig>["logger"],
  host: BootstrapOptions<TConfig>["host"]
): ModuleContext<TConfig> {
  return { config, container, diagnostics, logger, host };
}

function topologicalSort<TConfig>(modules: ModuleDefinition<TConfig>[]): ModuleDefinition<TConfig>[] {
  const pending = new Map(modules.map((module) => [module.name, module]));
  const emitted = new Set<string>();
  const ordered: ModuleDefinition<TConfig>[] = [];

  while (pending.size > 0) {
    const ready = Array.from(pending.values())
      .filter((module) => (module.dependsOn ?? []).every((dependency) => emitted.has(dependency)))
      .sort((left, right) => left.name.localeCompare(right.name));

    if (ready.length === 0) {
      const blocked = Array.from(pending.values()).map((module) => ({
        module: module.name,
        dependsOn: module.dependsOn ?? [],
      }));
      throw new Error(`Module dependency cycle or missing dependency: ${JSON.stringify(blocked)}`);
    }

    for (const module of ready) {
      ordered.push(module);
      emitted.add(module.name);
      pending.delete(module.name);
    }
  }

  return ordered;
}

async function registerTools<TConfig>(
  definitions: ToolDefinition<TConfig>[],
  context: RuntimeContext<TConfig>
): Promise<void> {
  const ordered = [...definitions].sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));
  for (const definition of ordered) {
    await context.host.registerTool({
      name: definition.name,
      description: definition.description,
      schema: definition.schema,
      execute: async (params) => definition.execute(params, context),
    });
    context.diagnostics.loadedTools.push(definition.name);
  }
}

async function registerHooks<TConfig>(
  definitions: HookDefinition<TConfig>[],
  context: RuntimeContext<TConfig>
): Promise<void> {
  const ordered = [...definitions].sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));
  for (const definition of ordered) {
    await context.host.registerHook({
      event: definition.event,
      priority: definition.priority ?? 0,
      handler: async (payload) => {
        await definition.handle(payload, context);
      },
    });
    context.diagnostics.loadedHooks.push(`${definition.event}:${definition.name}`);
  }
}

async function registerClis<TConfig>(
  definitions: CliDefinition<TConfig>[],
  context: RuntimeContext<TConfig>
): Promise<void> {
  const ordered = [...definitions].sort((left, right) => left.name.localeCompare(right.name));
  for (const definition of ordered) {
    await context.host.registerCli({
      name: definition.name,
      description: definition.description,
      execute: async (args) => definition.execute(args, context),
    });
    context.diagnostics.loadedClis.push(definition.name);
  }
}

async function registerCommands<TConfig>(
  definitions: CommandDefinition<TConfig>[],
  context: RuntimeContext<TConfig>
): Promise<void> {
  const ordered = [...definitions].sort((left, right) => left.name.localeCompare(right.name));
  for (const definition of ordered) {
    await context.host.registerCommand({
      name: definition.name,
      description: definition.description,
      acceptsArgs: definition.acceptsArgs,
      requireAuth: definition.requireAuth,
      handler: async (args) => definition.handler(args, context),
    });
    context.diagnostics.loadedCommands.push(definition.name);
  }
}

export async function bootstrapMicrokernel<TConfig>(
  options: BootstrapOptions<TConfig>
): Promise<KernelRuntime<TConfig>> {
  const logger = options.logger ?? createConsoleLogger(options.appId);
  const container = new MapServiceContainer();
  const diagnostics = createDiagnostics();
  const context = createContext(options.config, container, diagnostics, logger, options.host);

  container.register("config", options.config);
  container.register("logger", logger);
  container.register("host", options.host);
  container.register("diagnostics", diagnostics);

  const startedModules: ModuleDefinition<TConfig>[] = [];

  const startTimed = async (label: string, action: () => Promise<void>): Promise<void> => {
    const startedAt = Date.now();
    try {
      await action();
      diagnostics.timings[label] = Date.now() - startedAt;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      diagnostics.failures.push({ unit: label, reason });
      throw error;
    }
  };

  const moduleDefinitions = topologicalSort(await loadDefinitions(options.registry.modules));
  const toolDefinitions = await loadDefinitions(options.registry.tools);
  const hookDefinitions = await loadDefinitions(options.registry.hooks);
  const cliDefinitions = await loadDefinitions(options.registry.clis);
  const commandDefinitions = await loadDefinitions(options.registry.commands);

  for (const moduleDefinition of moduleDefinitions) {
    await startTimed(`module:setup:${moduleDefinition.name}`, async () => {
      await moduleDefinition.setup(context);
    });
    diagnostics.loadedModules.push(moduleDefinition.name);
  }

  for (const moduleDefinition of moduleDefinitions) {
    if (!moduleDefinition.start) {
      continue;
    }
    await startTimed(`module:start:${moduleDefinition.name}`, async () => {
      await moduleDefinition.start?.(context);
    });
    startedModules.push(moduleDefinition);
  }

  await startTimed("tools:register", async () => {
    await registerTools(toolDefinitions, context);
  });

  await startTimed("hooks:register", async () => {
    await registerHooks(hookDefinitions, context);
  });

  await startTimed("clis:register", async () => {
    await registerClis(cliDefinitions, context);
  });

  await startTimed("commands:register", async () => {
    await registerCommands(commandDefinitions, context);
  });

  logger.info("Microkernel boot complete", {
    appId: options.appId,
    modules: diagnostics.loadedModules.length,
    tools: diagnostics.loadedTools.length,
    hooks: diagnostics.loadedHooks.length,
    clis: diagnostics.loadedClis.length,
    commands: diagnostics.loadedCommands.length,
  });

  return {
    appId: options.appId,
    diagnostics,
    container,
    shutdown: async () => {
      for (const moduleDefinition of [...startedModules].reverse()) {
        if (!moduleDefinition.shutdown) {
          continue;
        }
        await startTimed(`module:shutdown:${moduleDefinition.name}`, async () => {
          await moduleDefinition.shutdown?.(context);
        });
      }
      logger.info("Microkernel shutdown complete", { appId: options.appId });
    },
  };
}
