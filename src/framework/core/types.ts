export type ModulePhase = "bootstrap" | "runtime";

export interface FrameworkLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug?(message: string, meta?: Record<string, unknown>): void;
}

export interface KernelDiagnostics {
  loadedModules: string[];
  loadedTools: string[];
  loadedHooks: string[];
  loadedClis: string[];
  loadedCommands: string[];
  timings: Record<string, number>;
  failures: Array<{ unit: string; reason: string }>;
}

export interface ServiceContainer {
  register<T>(key: string, value: T): void;
  resolve<T>(key: string): T;
  tryResolve<T>(key: string): T | undefined;
  has(key: string): boolean;
  entries(): Array<[string, unknown]>;
}

export interface HostToolRegistration {
  name: string;
  description: string;
  schema?: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export interface HostHookRegistration {
  event: string;
  handler: (payload: unknown) => Promise<void>;
  priority: number;
}

export interface HostCliRegistration {
  name: string;
  description: string;
  execute: (args: string[]) => Promise<unknown>;
}

export interface HostCommandRegistration {
  name: string;
  description: string;
  acceptsArgs?: boolean;
  requireAuth?: boolean;
  handler: (args?: string) => Promise<{ text: string }>;
}

export interface HostAdapter {
  registerTool(tool: HostToolRegistration): Promise<void> | void;
  registerHook(hook: HostHookRegistration): Promise<void> | void;
  registerCli(cli: HostCliRegistration): Promise<void> | void;
  registerCommand(command: HostCommandRegistration): Promise<void> | void;
}

export interface ModuleContext<TConfig = unknown> {
  config: TConfig;
  container: ServiceContainer;
  logger: FrameworkLogger;
  host: HostAdapter;
  diagnostics: KernelDiagnostics;
}

export interface RuntimeContext<TConfig = unknown> extends ModuleContext<TConfig> {}

export interface BaseDefinition {
  kind: "module" | "tool" | "hook" | "cli" | "command";
  name: string;
  description?: string;
  priority?: number;
}

export interface ModuleDefinition<TConfig = unknown> extends BaseDefinition {
  kind: "module";
  phase?: ModulePhase;
  dependsOn?: string[];
  provides?: string[];
  setup: (context: ModuleContext<TConfig>) => Promise<void> | void;
  start?: (context: ModuleContext<TConfig>) => Promise<void> | void;
  shutdown?: (context: ModuleContext<TConfig>) => Promise<void> | void;
}

export interface ToolDefinition<TConfig = unknown> extends BaseDefinition {
  kind: "tool";
  description: string;
  schema?: Record<string, unknown>;
  execute: (
    params: Record<string, unknown>,
    context: RuntimeContext<TConfig>
  ) => Promise<unknown> | unknown;
}

export interface HookDefinition<TConfig = unknown> extends BaseDefinition {
  kind: "hook";
  event: string;
  handle: (payload: unknown, context: RuntimeContext<TConfig>) => Promise<void> | void;
}

export interface CliDefinition<TConfig = unknown> extends BaseDefinition {
  kind: "cli";
  description: string;
  execute: (args: string[], context: RuntimeContext<TConfig>) => Promise<unknown> | unknown;
}

export interface CommandDefinition<TConfig = unknown> extends BaseDefinition {
  kind: "command";
  description: string;
  acceptsArgs?: boolean;
  requireAuth?: boolean;
  handler: (
    args: string | undefined,
    context: RuntimeContext<TConfig>
  ) => Promise<{ text: string }> | { text: string };
}

export type AnyDefinition<TConfig = unknown> =
  | ModuleDefinition<TConfig>
  | ToolDefinition<TConfig>
  | HookDefinition<TConfig>
  | CliDefinition<TConfig>
  | CommandDefinition<TConfig>;

export type DefinitionLoader<T> = () => Promise<T | { default: T }>;

export interface DefinitionRegistry<TConfig = unknown> {
  modules: Array<DefinitionLoader<ModuleDefinition<TConfig>>>;
  tools: Array<DefinitionLoader<ToolDefinition<TConfig>>>;
  hooks: Array<DefinitionLoader<HookDefinition<TConfig>>>;
  clis: Array<DefinitionLoader<CliDefinition<TConfig>>>;
  commands: Array<DefinitionLoader<CommandDefinition<TConfig>>>;
}

export interface BootstrapOptions<TConfig = unknown> {
  appId: string;
  config: TConfig;
  registry: DefinitionRegistry<TConfig>;
  host: HostAdapter;
  logger?: FrameworkLogger;
}

export interface KernelRuntime<TConfig = unknown> {
  appId: string;
  diagnostics: KernelDiagnostics;
  container: ServiceContainer;
  shutdown: () => Promise<void>;
}
